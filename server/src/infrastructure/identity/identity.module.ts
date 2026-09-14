import { Global, Module } from '@nestjs/common';

import { TypedConfigService } from '../../config/app-config.module.js';
import { FakeIdentityVerifier } from './adapters/fake-identity.verifier.js';
import { JwksIdentityVerifier } from './adapters/jwks-identity.verifier.js';
import { IDENTITY_VERIFIER } from './identity.port.js';

/**
 * Doğrulayıcının seçildiği tek yer.
 *
 * Ortama göre seçim BURADA bilinçli: sahte doğrulayıcı jetonu hiç kontrol
 * etmiyor, yani üretimde aktif olması "herkes istediği hesaba girebilir"
 * demek. Bu yüzden seçim bir `useClass` sabitine değil, ortamı okuyan bir
 * fabrikaya bağlı — yanlışlıkla üretime sızması imkânsız.
 */
@Global()
@Module({
  providers: [
    FakeIdentityVerifier,
    JwksIdentityVerifier,
    {
      provide: IDENTITY_VERIFIER,
      inject: [TypedConfigService, FakeIdentityVerifier, JwksIdentityVerifier],
      useFactory: (
        config: TypedConfigService,
        fake: FakeIdentityVerifier,
        real: JwksIdentityVerifier,
      ) => (config.isProduction ? real : fake),
    },
  ],
  exports: [IDENTITY_VERIFIER],
})
export class IdentityModule {}
