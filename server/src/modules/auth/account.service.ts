import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { IdentityProvider } from '../../generated/prisma/enums.js';
import { IDENTITY_VERIFIER, type IdentityVerifier } from '../../infrastructure/identity/identity.port.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * Hesabın kendisiyle ilgili işlemler. Bugün tek iş: silme.
 *
 * Şifre değiştirme / sıfırlama / doğrulama YOK, çünkü şifre yok — giriş
 * yalnızca Apple ya da Google ile. Bu, silinen koddan çok daha fazlasını
 * siliyor: kaba kuvvet, hesap sayımı, sıfırlama jetonu çalınması ve şifre
 * saklama sorumluluğu da beraberinde gidiyor.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IDENTITY_VERIFIER) private readonly verifier: IdentityVerifier,
  ) {}

  /**
   * Hesabı ve bağlı bütün verisini siler.
   *
   * ZORUNLU: Apple App Store, hesap açmaya izin veren uygulamanın hesabı
   * uygulama içinden silmeye de izin vermesini şart koşuyor (5.1.1(v));
   * Play'in de benzer bir gereği var. Yani yayın engeli, incelik değil.
   *
   * BAĞLI HESAPTA YENİDEN KİMLİK DOĞRULAMA İSTENİYOR. Access token 15 dakika
   * yaşıyor ve silme geri alınamaz: telefonu bir süreliğine eline geçiren
   * birinin hesabı silebilmesi kabul edilemez. Sağlayıcıdan taze bir jeton
   * istemek, "gerçekten sen misin"i sağlayıcıya sordurmak demek — Apple ve
   * Google da kendi silme akışlarında aynısını yapıyor.
   *
   * Misafir hesapta kimlik yok, dolayısıyla doğrulanacak bir şey de yok;
   * orada onay istemcideki açık uyarıyla alınıyor.
   *
   * Silme GERÇEK (yumuşak silme değil): cüzdan, defter, koleksiyon, maçlar,
   * cihazlar `onDelete: Cascade` ile gidiyor. Gerçek parayla satın alma
   * eklendiğinde bu karar yeniden ele alınmalı — iade ve muhasebe için
   * kimliksizleştirilmiş kayıt gerekecek.
   */
  async deleteAccount(
    userId: string,
    confirmation?: { provider: IdentityProvider; idToken: string },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true, identities: { select: { provider: true, subject: true } } },
    });
    if (!user) throw new NotFoundException('Hesap bulunamadı');

    if (user.identities.length > 0) {
      if (!confirmation) {
        throw new BadRequestException(
          'Hesabı silmek için giriş yaptığın hesapla yeniden doğrulaman gerekiyor',
        );
      }
      const verified = await this.verifier.verify(confirmation.provider, confirmation.idToken);
      const matches = user.identities.some(
        (i) => i.provider === confirmation.provider && i.subject === verified.subject,
      );
      if (!matches) {
        throw new BadRequestException('Doğrulama bu hesaba ait değil');
      }
    }

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`Hesap silindi: ${userId}`);
  }
}
