import type { IdentityProvider } from '@/api/types';

/**
 * Apple / Google kimlik jetonunu ALIR — sunucuya gönderilecek olan.
 *
 * Gerçek uygulama iki native kütüphane istiyor (`expo-apple-authentication`
 * ve Google için `expo-auth-session`) ve ikisi de **Expo Go'da çalışmıyor**:
 * geliştirme derlemesi (EAS build ya da yerel dev build) gerekiyor. Ayrıca
 * Apple/Google geliştirici hesapları ve istemci kimlikleri de henüz yok.
 *
 * Bu dosya o beklemeyi tek yere hapsediyor. Bugün geliştirme kipinde sahte
 * bir jeton üretiyor — sunucudaki `FakeIdentityVerifier` ile birebir aynı
 * biçim (`sahte:<subject>`), yani akışın tamamı (giriş, hoş geldin hediyesi,
 * cihaz değiştirip hesaba dönme) Expo Go'da uçtan uca denenebiliyor.
 *
 * Kimlik bilgileri geldiğinde değişen tek dosya bu olacak; çağıran hiçbir
 * ekran farkı görmeyecek.
 */

export class ProviderSignInError extends Error {}
/** Kullanıcı sağlayıcı ekranını kapattı — hata değil, vazgeçme. */
export class ProviderSignInCancelled extends ProviderSignInError {}

export interface ProviderCredential {
  provider: IdentityProvider;
  idToken: string;
}

/**
 * Sağlayıcı ekranını açar ve kimlik jetonunu döndürür.
 *
 * @param subjectHint Yalnızca geliştirme sahte jetonunda kullanılıyor: aynı
 *   ipucuyla tekrar çağrılınca aynı "hesaba" dönülüyor, böylece cihaz
 *   değiştirme senaryosu elle denenebiliyor.
 */
export async function getProviderCredential(
  provider: IdentityProvider,
  subjectHint?: string,
): Promise<ProviderCredential> {
  if (__DEV__) {
    // Geliştirme: sunucudaki sahte doğrulayıcının anladığı biçim.
    // Üretim derlemesinde bu dal hiç yer almıyor.
    const subject = subjectHint ?? `dev-${provider.toLowerCase()}`;
    return Promise.resolve({ provider, idToken: `sahte:${subject}` });
  }

  throw new ProviderSignInError(
    'Giriş henüz kullanılamıyor. Uygulamanın güncel sürümünü yüklediğinden emin ol.',
  );
}
