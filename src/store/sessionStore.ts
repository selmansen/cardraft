import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { hasSession, setTokens } from '@/api/client';
import { useGameStore } from './gameStore';
import { authApi, economyApi, inventoryApi, storeApi } from '@/api/endpoints';
import { ApiError, errorMessage, NetworkError } from '@/api/errors';
import { readMigrated, STORAGE_KEYS } from '@/api/storageKeys';
import type { AuthUser, CurrencyCode, DevicePlatform, PackOpenResult } from '@/api/types';

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
  openPack: (packId: string, requestId: string) => Promise<PackOpenResult | { error: string }>;
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
    try {
      if (await hasSession()) {
        const user = await authApi.me();
        set({ user, connection: 'online' });
      } else {
        const stored = await installationId();
        const result = await authApi.guest({
          installationId: stored,
          platform: platform(),
          appVersion: '0.1.0',
        });
        await setTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        // Sunucunun ürettiği kimliği saklıyoruz: bir dahaki açılışta aynı
        // misafir hesaba dönmenin tek yolu bu.
        if (result.installationId) {
          await AsyncStorage.setItem(INSTALL_KEY, result.installationId);
        }
        set({ user: result.user, connection: 'online' });
      }
      await Promise.all([get().refreshWallet(), get().refreshInventory()]);
    } catch (error) {
      if (error instanceof NetworkError) {
        set({ connection: 'offline' });
      } else if (error instanceof ApiError && error.isAuthError) {
        // Oturum gerçekten geçersiz: temizle ki bir sonraki açılış yeniden
        // misafir girişi denesin.
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

  openPack: async (packId, requestId) => {
    try {
      const result = await storeApi.openPack(packId, requestId);
      set((s) => ({
        rims: result.balance.balance,
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

  signOut: async () => {
    await setTokens(null);
    set({ user: null, rims: 0, coins: 0, ownedVehicles: new Set(), ownedSupport: new Set() });
  },
}));
