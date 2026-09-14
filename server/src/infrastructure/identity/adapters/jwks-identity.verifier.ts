import { BadRequestException, Injectable } from '@nestjs/common';

import { TypedConfigService } from '../../../config/app-config.module.js';
import { IdentityProvider } from '../../../generated/prisma/enums.js';
import type { IdentityVerifier, VerifiedIdentity } from '../identity.port.js';

/**
 * Gerçek doğrulayıcı — İSKELET, henüz tamamlanmadı.
 *
 * Apple ve Google kimlik jetonları imzalı JWT'ler; doğrulamak için
 * sağlayıcının açık anahtarları (JWKS) ve bizim istemci kimliklerimiz
 * gerekiyor:
 *
 *   Google · JWKS https://www.googleapis.com/oauth2/v3/certs
 *            iss   https://accounts.google.com
 *            aud   GOOGLE_CLIENT_ID (iOS ve Android için ayrı olabilir)
 *
 *   Apple  · JWKS https://appleid.apple.com/auth/keys
 *            iss   https://appleid.apple.com
 *            aud   APPLE_BUNDLE_ID
 *
 * Doldurulmadan önce yapılacaklar: `jose` paketini ekle, JWKS'i uzaktan ve
 * ÖNBELLEKLİ çek (her girişte anahtar indirmek hem yavaş hem sağlayıcıya
 * yük), imzayı + `iss` + `aud` + `exp` alanlarını doğrula.
 *
 * `aud` doğrulaması atlanamaz: başka bir uygulamaya verilmiş geçerli bir
 * Google jetonu, kontrol edilmezse bizde de geçerli sayılır ve o uygulamanın
 * sahibi bütün oyuncularımızın hesabına girebilir.
 */
@Injectable()
export class JwksIdentityVerifier implements IdentityVerifier {
  constructor(private readonly config: TypedConfigService) {}

  verify(provider: IdentityProvider, _idToken: string): Promise<VerifiedIdentity> {
    void this.config;
    void provider;
    void _idToken;
    throw new BadRequestException(
      'Sağlayıcı girişi henüz yapılandırılmadı (Apple/Google istemci kimlikleri eksik)',
    );
  }
}

/** Sağlayıcı sabitleri — doğrulayıcı tamamlanırken kullanılacak. */
export const PROVIDER_CONFIG: Record<IdentityProvider, { issuer: string; jwks: string }> = {
  [IdentityProvider.GOOGLE]: {
    issuer: 'https://accounts.google.com',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  [IdentityProvider.APPLE]: {
    issuer: 'https://appleid.apple.com',
    jwks: 'https://appleid.apple.com/auth/keys',
  },
};
