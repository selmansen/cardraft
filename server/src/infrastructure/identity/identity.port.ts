import type { IdentityProvider } from '../../generated/prisma/enums.js';

export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');

export interface VerifiedIdentity {
  /** Sağlayıcının kalıcı kullanıcı kimliği (JWT'deki `sub`). */
  subject: string;
  /** Sağlayıcının bildirdiği e-posta. Apple gizli röle adresi verebiliyor. */
  email?: string;
}

/**
 * Apple / Google kimlik jetonunun doğrulanması — sağlayıcının arkasına
 * saklandığı kapı.
 *
 * Neden port: gerçek doğrulama Apple ve Google'ın açık anahtarlarına (JWKS)
 * ve bizim istemci kimliklerimize ihtiyaç duyuyor; ikisi de henüz yok, çünkü
 * geliştirici hesapları açılmadı. Port sayesinde bağlama mantığı (kimlik
 * bul / yoksa hesap aç / misafiri yükselt) bugün yazılıp test edilebiliyor;
 * kimlik bilgileri geldiğinde değişen tek şey `identity.module.ts`'teki
 * `useClass`.
 *
 * Aynı desen kuyruk, bildirim ve e-postada da kullanıldı.
 */
export interface IdentityVerifier {
  verify(provider: IdentityProvider, idToken: string): Promise<VerifiedIdentity>;
}
