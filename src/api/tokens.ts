import AsyncStorage from '@react-native-async-storage/async-storage';

import { readMigrated, STORAGE_KEYS } from './storageKeys';

const KEY = STORAGE_KEYS.session;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Token deposu — bilerek tek dosyaya kapatıldı.
 *
 * Şu an AsyncStorage kullanıyoruz: şifrelenmemiş, yani root'lanmış/jailbreak
 * bir cihazda okunabilir. Bir oyun için kabul edilebilir bir risk (çalınan
 * token'ın verebileceği zarar oyuncunun kendi hesabıyla sınırlı ve refresh
 * token rotasyonlu, sunucuda iptal edilebilir).
 *
 * Doğrusu `expo-secure-store` (iOS Keychain / Android Keystore) ve oraya
 * geçilecek — ama yeni bir bağımlılık kurulum gerektiriyor. Depo bu arayüzün
 * arkasında olduğu için geçiş SADECE bu dosyayı değiştirmek olacak; çağıran
 * hiçbir yer AsyncStorage'ı görmüyor.
 */
export const tokenStore = {
  async read(): Promise<SessionTokens | null> {
    try {
      // Eski anahtardan otomatik taşınır — bkz. storageKeys.ts.
      const raw = await readMigrated(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SessionTokens>;
      if (!parsed.accessToken || !parsed.refreshToken) return null;
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    } catch {
      // Bozuk kayıt oturumsuz sayılır: uygulamanın açılmaması, yeniden
      // giriş yapmaktan çok daha kötü bir sonuç.
      return null;
    }
  },

  async write(tokens: SessionTokens): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(tokens));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  },
};
