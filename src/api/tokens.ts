import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { readMigrated, STORAGE_KEYS } from './storageKeys';

const KEY = STORAGE_KEYS.session;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Token deposu — bilerek tek dosyaya kapatıldı.
 *
 * Oturum jetonları artık `expo-secure-store` ile saklanıyor: iOS'ta Keychain,
 * Android'de Keystore ile şifrelenmiş EncryptedSharedPreferences. Öncesinde
 * AsyncStorage kullanılıyordu ve orada değer DÜZ METİN duruyor — root'lanmış
 * ya da jailbreak bir cihazda, ayrıca cihaz yedeklerinde okunabilir.
 *
 * Oyuna özel bir risk olmasa da (çalınan jetonun zararı oyuncunun kendi
 * hesabıyla sınırlı, refresh rotasyonlu ve sunucuda iptal edilebilir) yayına
 * çıkmadan yapılması gereken bir işti: mağazaya gönderilen bir uygulamada
 * "kimlik jetonu şifresiz diskte" savunulabilir bir varsayılan değil.
 *
 * Depo bu arayüzün arkasında olduğu için geçiş gerçekten sadece bu dosyayı
 * değiştirdi — çağıran hiçbir yer nerede saklandığını görmüyor.
 */

/**
 * SecureStore native modül; web'de yok.
 *
 * Web yalnızca geliştirme kolaylığı için açık (`expo start --web`) ve orada
 * Keychain'in karşılığı da yok. Sessizce AsyncStorage'a düşüyoruz: web'de
 * ZATEN şifreli bir seçenek olmadığı için bu bir gerileme değil, aynı
 * seviyede kalmak. Gerçek platformlarda bu dal hiç çalışmıyor.
 */
const secureAvailable = Platform.OS !== 'web';

async function readRaw(): Promise<string | null> {
  if (!secureAvailable) return readMigrated(KEY);

  const secure = await SecureStore.getItemAsync(KEY);
  if (secure !== null) return secure;

  /**
   * GEÇİŞ: jeton daha önce AsyncStorage'da saklanıyordu.
   *
   * Taşınmasa da uygulama çalışırdı — oturum geçersiz sayılır, misafir
   * oturumu yeniden açılır (bkz. sessionStore.bootstrap). Ama bağlı bir
   * hesapta cihaz zaten o hesaba bağlı olduğu için misafir girişi
   * reddedilir ve oyuncu yeniden Apple/Google ile girmek zorunda kalırdı.
   * Sebepsiz bir giriş ekranı; taşımak birkaç satır.
   *
   * Sıra önemli: önce güvenli depoya yaz, sonra eskisini sil. Ters sırada
   * arada uygulama kapanırsa jeton tamamen kaybolurdu.
   */
  const legacy = await readMigrated(KEY);
  if (legacy === null) return null;
  await SecureStore.setItemAsync(KEY, legacy);
  await AsyncStorage.removeItem(KEY);
  return legacy;
}

export const tokenStore = {
  async read(): Promise<SessionTokens | null> {
    try {
      const raw = await readRaw();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SessionTokens>;
      if (!parsed.accessToken || !parsed.refreshToken) return null;
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    } catch {
      // Bozuk ya da okunamayan kayıt oturumsuz sayılır: uygulamanın
      // açılmaması, yeniden giriş yapmaktan çok daha kötü bir sonuç.
      // SecureStore, cihaz kilidi değiştiğinde de hata verebiliyor.
      return null;
    }
  },

  async write(tokens: SessionTokens): Promise<void> {
    const raw = JSON.stringify(tokens);
    if (secureAvailable) await SecureStore.setItemAsync(KEY, raw);
    else await AsyncStorage.setItem(KEY, raw);
  },

  async clear(): Promise<void> {
    // İkisi de siliniyor: geçiş tamamlanmamış bir cihazda eski anahtar
    // altında kalan jeton, "çıkış yaptım" diyen oyuncunun oturumunu geri
    // getirirdi.
    if (secureAvailable) await SecureStore.deleteItemAsync(KEY);
    await AsyncStorage.removeItem(KEY);
  },
};
