import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { IdentityProvider } from '../../../generated/prisma/enums.js';
import type { IdentityVerifier, VerifiedIdentity } from '../identity.port.js';

/**
 * Geliştirme doğrulayıcısı — jetonu KONTROL ETMEZ, içindekini okur.
 *
 * Beklediği biçim: `sahte:<subject>[:<email>]`. Böylece Apple/Google
 * geliştirici hesapları açılmadan da bağlama akışının tamamı (yeni hesap,
 * mevcut kimlikle giriş, misafir yükseltme) uçtan uca denenebiliyor.
 *
 * ÜRETİMDE ASLA AKTİF OLMAMALI: herkesin istediği kimliğe girmesi demek.
 * Bu yüzden `identity.module.ts` üretimde bu adapter'ı seçmeyi reddediyor ve
 * burada da her çağrıda uyarı yazılıyor.
 */
@Injectable()
export class FakeIdentityVerifier implements IdentityVerifier {
  private readonly logger = new Logger(FakeIdentityVerifier.name);

  verify(provider: IdentityProvider, idToken: string): Promise<VerifiedIdentity> {
    this.logger.warn(`SAHTE kimlik doğrulaması (${provider}) — yalnızca geliştirme içindir`);

    const parts = idToken.split(':');
    if (parts[0] !== 'sahte' || !parts[1]) {
      throw new BadRequestException('Kimlik jetonu geçersiz');
    }
    return Promise.resolve({ subject: parts[1], email: parts[2] || undefined });
  }
}
