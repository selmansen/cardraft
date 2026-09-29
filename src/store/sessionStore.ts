import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { hasSession, setTokens } from '@/api/client';
import { useGameStore } from './gameStore';
import { authApi, economyApi, inventoryApi, storeApi } from '@/api/endpoints';
import { ApiError, errorMessage, NetworkError } from '@/api/errors';
import { readMigrated, STORAGE_KEYS } from '@/api/storageKeys';
import type {
  AuthUser,
  Currency,
  CurrencyCode,
  DevicePlatform,
  IdentityProvider,
  PackOpenResult,
} from '@/api/types';
import { getProviderCredential, ProviderSignInCancelled } from '@/auth/providerSignIn';
import { pullLoadout } from './loadoutSync';

const INSTALL_KEY = STORAGE_KEYS.installation;

/**
 * Sunucu oturumu — oyunun yerel durumundan (gameStore) AYRI tutuluyor.
 *
 * İkisini tek store'a koymak cazip ama yanlış olurdu: gameStore diske
 * yazılıyor ve oyunun her ekranı ona abone; oturum ise ağ katmanının durumu.
 * Birleştirilseydi her token yenilemesi tüm oyun ekranlarını yeniden
 * render ederdi ve token'lar oyun kaydına sızardı.
 */
export type ConnectionState = 'unknown' | 'online' | 'offline';

interface SessionState {
  user: AuthUser | null;
  connection: ConnectionState;
  /** İlk açılış akışı bitti mi (başarılı ya da çevrimdışı olarak). */
  ready: boolean;
  /** Sunucudaki bakiyeler — gösterim için önbellek, doğruluk kaynağı sunucu. */
  rims: number;
  coins: number;
  /**
   * Sunucudaki koleksiyon, iki havuz AYRI.
   *
   * Dizi değil küme: ekranların tek sorusu "bu karta sahip miyim" ve bunu
   * dizide aramak, 46 kartlık bir ızgarada her render'da 46 doğrusal arama
   * demek olurdu.
   *
   * İkiye ayrılmalarının sebebi sayaçlar: "Garajında 7 / 35 araç var" gibi
   * bir metin, tek kümede destek kartlarını da sayardı. Sunucu her kartın
   * hangi havuzdan olduğunu (`kind`) zaten söylüyor.
   */
  ownedVehicles: Set<string>;
  ownedSupport: Set<string>;

  bootstrap: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshInventory: () => Promise<void>;
  /** Kart açar. Dönen mesaj null ise başarılı; değilse kullanıcıya gösterilir. */
  unlockCard: (cardId: string, currency: CurrencyCode) => Promise<string | null>;
  /**
   * Paket açar. Başarılıysa sonucu, değilse hata mesajını döndürür.
   *
   * `requestId` DIŞARIDAN geliyor: ekran onu bir kez üretip saklıyor ki
   * yeniden deneme aynı kimlikle gitsin. Burada üretilseydi her çağrı yeni
   * bir kimlik alır ve sunucudaki tekrar koruması işe yaramazdı.
   */
  openPack: (
    packId: string,
    currency: Currency,
    requestId: string,
  ) => Promise<PackOpenResult | { error: string }>;
  /**
   * Apple / Google ile giriş.
   *
   * Misafir oturumunun ÜSTÜNE yapılıyor: sunucu tek uçla üç işi birden
   * görüyor — misafiri yükseltmek, daha önce bağlanmış hesaba dönmek, ve
   * cihaz değiştiren oyuncunun hesabını geri vermek. Dönen mesaj null ise
   * başarılı; 'cancelled' ise oyuncu vazgeçti (hata gösterilmemeli).
   *
   * @param devSubject GEÇİCİ, yalnızca geliştirme: sahte jetonun kimliğini
   *   sabitler, böylece her cihazda aynı test hesabına girilir. Bkz.
   *   src/dev/adminLogin.ts — o dosyayla birlikte silinecek.
   */
  signInWithProvider: (
    provider: IdentityProvider,
    devSubject?: string,
  ) => Promise<string | null | 'cancelled'>;
  signOut: () => Promise<void>;
}

/**
 * Saklanan kurulum kimliği. Eski anahtardan otomatik taşınır: bu değer misafir
 * hesabın sunucudaki kimliği, kaybedilirse oyuncunun ilerlemesi erişilemez
 * hâle gelirdi (bkz. storageKeys.ts).
 */
async function installationId(): Promise<string | undefined> {
  return (await readMigrated(INSTALL_KEY)) ?? undefined;
}

function platform(): DevicePlatform {
  return Platform.OS === 'android' ? 'ANDROID' : 'IOS';
}

/**
 * Misafir oturumu açar, jetonları ve kurulum kimliğini saklar.
 *
 * Store'un dışında: iki yerden çağrılıyor (açılış ve giriş öncesi) ve ikisi
 * de aynı garantiye ihtiyaç duyuyor — "bu noktadan sonra bir oturum var".
 */
async function createGuestSession(): Promise<AuthUser> {
  const stored = await installationId();
  const result = await authApi.guest({
    installationId: stored,
    platform: platform(),
    appVersion: '0.1.0',
  });
  await setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  // Sunucunun ürettiği kimliği saklıyoruz: bir dahaki açılışta aynı misafir
  // hesaba dönmenin tek yolu bu.
  if (result.installationId) {
    await AsyncStorage.setItem(INSTALL_KEY, result.installationId);
  }
  return result.user;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  user: null,
  connection: 'unknown',
  ready: false,
  rims: 0,
  coins: 0,
  ownedVehicles: new Set<string>(),
  ownedSupport: new Set<string>(),

  /**
   * Açılış: oturum yoksa misafir hesap açar, varsa cüzdanı tazeler.
   *
   * Ağ hatası uygulamayı DURDURMAZ. Oyun çevrimdışı oynanabiliyor; sunucuya
   * ulaşamamak "bağlanana kadar bekle" değil "çevrimdışı devam et" anlamına
   * geliyor. `ready` her iki durumda da true oluyor, yoksa uçakta uygulamayı
   * açan oyuncu sonsuza kadar açılış ekranında kalırdı.
   */
  bootstrap: async () => {
    const guestLogin = async () => {
      set({ user: await createGuestSession(), connection: 'online' });
    };

    try {
      if (await hasSession()) {
        try {
          const user = await authApi.me();
          set({ user, connection: 'online' });
        } catch (error) {
          // Saklanan oturum artık geçerli değil (yenileme jetonunun süresi
          // dolmuş, sunucu sıfırlanmış, hesap silinmiş…). Temizleyip HEMEN
          // yeni bir misafir oturumu açıyoruz.
          //
          // Eskiden sadece temizleniyordu ve "bir sonraki açılış halleder"
          // deniyordu — ama o açılışa kadar uygulamanın oturumu hiç yoktu:
          // kimlik isteyen her çağrı (cüzdan, envanter, hatta GİRİŞ) 401
          // dönüyordu. Oyuncu tarafında bu "giriş yapamıyorum, Unauthorized
          // diyor" olarak görünüyordu ve uygulamayı kapatıp açmadan
          // düzelmiyordu.
          if (!(error instanceof ApiError) || !error.isAuthError) throw error;
          await setTokens(null);
          await guestLogin();
        }
      } else {
        await guestLogin();
      }
      await Promise.all([get().refreshWallet(), get().refreshInventory()]);
      // Kadro koleksiyondan SONRA: sunucudan gelen kadro koleksiyonda olmayan
      // bir kartı işaret ederse ekranlar onu çizemez. Sıra bunu garanti ediyor.
      await pullLoadout();
    } catch (error) {
      if (error instanceof NetworkError) {
        set({ connection: 'offline' });
      } else if (error instanceof ApiError) {
        // Oturum kurulamadı ama sunucuya ULAŞILDI. İki meşru sebep var:
        // jeton geçersiz (401) ya da cihaz bir hesaba bağlı olduğu için
        // misafir girişi reddedildi (409). İkisinde de yapılacak şey aynı:
        // oturumsuz devam et ve oyuncuya giriş yapmasını söyle — çevrimdışı
        // demek yanlış olurdu, sunucu oradaydı ve cevap verdi.
        await setTokens(null);
        set({ user: null, connection: 'online' });
      } else {
        set({ connection: 'offline' });
      }
    } finally {
      set({ ready: true });
    }
  },

  refreshWallet: async () => {
    try {
      const balances = await economyApi.wallet();
      set({
        rims: balances.find((b) => b.currency === 'RIM')?.balance ?? 0,
        coins: balances.find((b) => b.currency === 'COIN')?.balance ?? 0,
        connection: 'online',
      });
    } catch (error) {
      if (error instanceof NetworkError) set({ connection: 'offline' });
    }
  },

  refreshInventory: async () => {
    try {
      const cards = await inventoryApi.list();
      const vehicles = cards.filter((c) => c.kind === 'VEHICLE').map((c) => c.cardId);
      const support = cards.filter((c) => c.kind === 'SUPPORT').map((c) => c.cardId);
      set({
        ownedVehicles: new Set(vehicles),
        ownedSupport: new Set(support),
        connection: 'online',
      });
      // Çevrimdışı görünüm için yerel önbelleğe de yaz.
      useGameStore.getState().cacheCollections(vehicles, support);
    } catch (error) {
      if (error instanceof NetworkError) set({ connection: 'offline' });
    }
  },

  /**
   * Kart açma tamamen sunucuda: istemci fiyatı GÖNDERMİYOR, sadece hangi
   * kart ve hangi kese. Bakiye düşürme ve kartın yazılması sunucuda tek bir
   * transaction — yerelde yapılsaydı, ödülleri sunucudan alıp harcamayı
   * cihazda yapan tutarsız bir ekonomi olurdu.
   */
  unlockCard: async (cardId, currency) => {
    try {
      const result = await inventoryApi.unlock(cardId, currency);
      const vehicle = result.card.kind === 'VEHICLE';
      set((s) => ({
        ownedVehicles: vehicle ? new Set(s.ownedVehicles).add(result.card.cardId) : s.ownedVehicles,
        ownedSupport: vehicle ? s.ownedSupport : new Set(s.ownedSupport).add(result.card.cardId),
        rims: result.balance.currency === 'RIM' ? result.balance.balance : s.rims,
        coins: result.balance.currency === 'COIN' ? result.balance.balance : s.coins,
      }));
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  },

  openPack: async (packId, currency, requestId) => {
    try {
      const result = await storeApi.openPack(packId, currency, requestId);
      set((s) => ({
        // Hangi kese döndüyse o güncelleniyor. Eskiden bakiye koşulsuz
        // `rims`'e yazılıyordu — paketler yalnızca jantla satıldığı sürece
        // doğruydu, coin ile ödeyen oyuncunun jantını coin bakiyesiyle
        // ezerdi.
        rims: result.balance.currency === 'RIM' ? result.balance.balance : s.rims,
        coins: result.balance.currency === 'COIN' ? result.balance.balance : s.coins,
        // Yeni kart geldiyse koleksiyona ekle; tekrar kartta koleksiyon
        // değişmiyor, yalnızca bakiye artıyor.
        ownedVehicles: result.duplicate
          ? s.ownedVehicles
          : new Set(s.ownedVehicles).add(result.card.cardId),
      }));
      // Çevrimdışı görünüm için yerel önbelleği de tazele.
      if (!result.duplicate) {
        const s = get();
        useGameStore
          .getState()
          .cacheCollections([...s.ownedVehicles], [...s.ownedSupport]);
      }
      return result;
    } catch (error) {
      return { error: errorMessage(error) };
    }
  },

  signInWithProvider: async (provider, devSubject) => {
    try {
      // Oturum yoksa da çağrılabiliyor: sunucudaki giriş ucu oturumu isteğe
      // bağlı kabul ediyor (bkz. AuthController @OptionalAuth). Burada
      // misafir oturumu açmaya ÇALIŞMAK yanlış olurdu — cihaz bir hesaba
      // bağlıysa sunucu misafir girişini bilerek reddediyor ve giriş
      // denemesi daha başlamadan 409 ile ölürdü.
      const credential = await getProviderCredential(provider, devSubject ?? (await installationId()));
      const result = await authApi.signInWithProvider({
        ...credential,
        installationId: (await installationId()) ?? '',
        platform: platform(),
        appVersion: '0.1.0',
      });
      await setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      set({ user: result.user, connection: 'online' });
      // Hesap değişmiş olabilir (cihaz değiştiren oyuncu eski hesabına döndü),
      // bu yüzden cüzdan ve koleksiyon yeniden okunuyor — eski hesabın
      // verisini göstermek en kötü hata olurdu. Kadro da aynı sebeple: giriş
      // yapan oyuncunun kendi kadrosu geliyor, misafirinki değil.
      await Promise.all([get().refreshWallet(), get().refreshInventory()]);
      await pullLoadout();
      return null;
    } catch (error) {
      if (error instanceof ProviderSignInCancelled) return 'cancelled';
      return errorMessage(error);
    }
  },

  signOut: async () => {
    await setTokens(null);
    set({ user: null, rims: 0, coins: 0, ownedVehicles: new Set(), ownedSupport: new Set() });
  },
}));
