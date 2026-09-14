import Constants from 'expo-constants';

const DEFAULT_PORT = 3000;

/**
 * API'nin adresi.
 *
 * Geliştirmede telefon, Mac'teki sunucuya LAN üzerinden bağlanıyor — yani
 * `localhost` işe yaramıyor, Mac'in IP'si gerekiyor. O IP'yi elle yazmak
 * ("her ağ değiştiğinde bir dosyayı düzenle") sürekli unutulan bir adım
 * olurdu, o yüzden Expo'nun geliştirme sunucusunun adresinden türetiyoruz:
 * `hostUri` zaten "192.168.1.34:8081" gibi geliyor, host kısmını alıp kendi
 * portumuzu ekliyoruz.
 *
 * Üretimde `EXPO_PUBLIC_API_URL` ile ezilir (EXPO_PUBLIC_ öneki, değişkenin
 * pakete gömülmesi için Expo'nun şartı).
 */
function resolveBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEFAULT_PORT}/api`;

  // Son çare: simülatör/web. Gerçek cihazda buraya düşerse istek zaten
  // başarısız olur ve çevrimdışı moda geçilir — sessizce yanlış adrese
  // gitmektense görünür şekilde bağlanamamak daha iyi.
  return `http://localhost:${DEFAULT_PORT}/api`;
}

export const API_BASE_URL = resolveBaseUrl();

/** Ağ isteklerinin üst sınırı. Oyun çevrimdışı da çalıştığı için uzun
 *  beklemek yerine hızlıca pes edip yerel moda düşmek daha iyi. */
export const REQUEST_TIMEOUT_MS = 8000;
