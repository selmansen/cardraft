import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cihazdaki depolama anahtarları — hepsi tek yerde.
 *
 * Proje "CarCraft"tan "CarDraft"a yeniden adlandırıldığında (2026-09-14) bu
 * anahtarların da değişmesi gerekti. Anahtar adı kullanıcıya görünmüyor ama
 * ALTINDAKİ DEĞER görünüyor: `installation-id`, misafir hesabın sunucudaki
 * kimliği. Anahtarı öylece değiştirmek uygulamanın "hiç kurulmamışım" sanıp
 * yepyeni bir hesap açmasına ve oyuncunun jantının, koleksiyonunun, galibiyet
 * sayacının eski hesapta erişilemez kalmasına yol açardı.
 *
 * Bu yüzden okumalar eski anahtara düşüyor ve bulduğunu yeni anahtara taşıyıp
 * eskisini siliyor. Taşıma bir kez oluyor, sonra eski anahtar hiç yok.
 *
 * GEÇİCİ: `LEGACY_PREFIX` ve `readMigrated`'ın yedek okuması yalnızca yeniden
 * adlandırma öncesi kurulmuş uygulamalar için var. Uygulama mağazaya hiç
 * çıkmadığı için tek etkilenen cihaz Selman'ın test telefonu; o bir kez
 * açtıktan sonra bu dosya sadeleştirilip yedek okuma silinebilir.
 */
const LEGACY_PREFIX = 'carcraft-';
const PREFIX = 'cardraft-';

export const STORAGE_KEYS = {
  session: `${PREFIX}session-v1`,
  installation: `${PREFIX}installation-id`,
  save: `${PREFIX}save-v1`,
} as const;

function legacyOf(key: string): string {
  return key.replace(PREFIX, LEGACY_PREFIX);
}

/**
 * Anahtarı okur; yoksa eski adına bakar ve bulursa taşır.
 *
 * Taşıma sırası önemli: önce yeniye yaz, sonra eskiyi sil. Ters sırada
 * yapılıp arada uygulama kapanırsa değer tamamen kaybolurdu.
 */
export async function readMigrated(key: string): Promise<string | null> {
  const current = await AsyncStorage.getItem(key);
  if (current !== null) return current;

  const legacy = await AsyncStorage.getItem(legacyOf(key));
  if (legacy === null) return null;

  await AsyncStorage.setItem(key, legacy);
  await AsyncStorage.removeItem(legacyOf(key));
  return legacy;
}

/**
 * Zustand'ın `persist`i için depolama sarmalayıcı.
 *
 * `createJSONStorage` bir `getItem/setItem/removeItem` üçlüsü bekliyor;
 * getItem'ı yukarıdaki göçten geçirmek, kaydın yeni anahtar altında
 * bulunmasını sağlıyor — persist'in kendi `migrate`i sürüm için, anahtar adı
 * için değil.
 */
export const migratingStorage = {
  getItem: (name: string) => readMigrated(name),
  setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
  removeItem: (name: string) => AsyncStorage.removeItem(name),
};
