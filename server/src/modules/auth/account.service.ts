import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { TypedConfigService } from '../../config/app-config.module.js';
import { TokenPurpose } from '../../generated/prisma/enums.js';
import { MAIL_PORT, type MailPort } from '../../infrastructure/mail/mail.port.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { TokenService } from './token.service.js';

/**
 * Hesap yönetimi: e-posta doğrulama, şifre sıfırlama/değiştirme, hesap silme.
 *
 * `AuthService`ten ayrı çünkü orası "kim olduğunu kanıtla ve içeri gir" ile
 * ilgili; burası hesabın kendisiyle. İkisi tek dosyada olsaydı en çok
 * değişecek ve en çok dikkat isteyen kod aynı yerde birikirdi.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: AuthTokenService,
    private readonly sessions: TokenService,
    private readonly config: TypedConfigService,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
  ) {}

  private link(path: string, token: string): string {
    // Derin bağlantı: e-postadaki bağlantı uygulamayı açıyor. Web karşılığı
    // gerektiğinde APP_LINK_BASE_URL bir https adresine çevrilir.
    return `${this.config.get('APP_LINK_BASE_URL')}${path}?token=${token}`;
  }

  /**
   * Doğrulama e-postası gönderir.
   *
   * Zaten doğrulanmışsa sessizce geçiyor: "zaten doğrulanmış" hatası vermek,
   * ekranı gereksiz bir hata durumuna sokar ve kullanıcı için anlamı yoktur.
   */
  async sendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true, displayName: true },
    });
    if (!user?.email) {
      throw new BadRequestException('Bu hesaba bağlı bir e-posta yok');
    }
    if (user.emailVerifiedAt) return;

    const token = await this.tokens.issue(userId, TokenPurpose.EMAIL_VERIFICATION);
    await this.mail.send({
      to: user.email,
      subject: 'CarDraft — e-posta adresini doğrula',
      text: [
        `Merhaba${user.displayName ? ' ' + user.displayName : ''},`,
        '',
        'CarDraft hesabının e-posta adresini doğrulamak için:',
        this.link('/verify-email', token),
        '',
        'Bağlantı 24 saat geçerli. Bu isteği sen yapmadıysan görmezden gelebilirsin —',
        'doğrulanmadığı sürece bu adres hesabına bağlı bir işe yaramaz.',
      ].join('\n'),
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.tokens.consume(token, TokenPurpose.EMAIL_VERIFICATION);
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /**
   * Şifre sıfırlama e-postası. HER DURUMDA sessizce başarılı sayılıyor.
   *
   * "Böyle bir hesap yok" demek, saldırgana hangi e-postaların kayıtlı
   * olduğunu tek tek deneyerek öğrenme imkânı verir (hesap sayımı). Oyuncuya
   * gösterilen mesaj her zaman aynı: "adres kayıtlıysa e-posta gönderdik".
   *
   * DOĞRULANMAMIŞ adrese sıfırlama GÖNDERİLMİYOR. Sebebi kritik: adresini
   * yanlış yazan (ya da bilerek başkasınınkini yazan) biri, o adrese gelen
   * bağlantıyla hesabı ele geçirebilirdi. Doğrulama tam olarak bunun için var.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true, passwordHash: true, displayName: true },
    });

    if (!user || !user.passwordHash) return;
    if (!user.emailVerifiedAt) {
      this.logger.warn(`Doğrulanmamış adrese sıfırlama istendi, gönderilmedi: ${email}`);
      return;
    }

    const token = await this.tokens.issue(user.id, TokenPurpose.PASSWORD_RESET);
    await this.mail.send({
      to: email,
      subject: 'CarDraft — şifre sıfırlama',
      text: [
        `Merhaba${user.displayName ? ' ' + user.displayName : ''},`,
        '',
        'Şifreni sıfırlamak için:',
        this.link('/reset-password', token),
        '',
        'Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir.',
        'Bu isteği sen yapmadıysan hiçbir şey yapmana gerek yok; şifren değişmedi.',
      ].join('\n'),
    });
  }

  /**
   * Şifreyi sıfırlar ve BÜTÜN oturumları kapatır.
   *
   * Oturumların kapatılması isteğe bağlı bir incelik değil: şifre sıfırlamanın
   * en yaygın sebebi "hesabıma başkası giriyor olabilir". Açık oturumlar
   * bırakılırsa o kişi içeride kalmaya devam eder ve sıfırlama bir işe
   * yaramaz.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.tokens.consume(token, TokenPurpose.PASSWORD_RESET);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }) },
    });
    await this.sessions.revokeAllForUser(userId);
  }

  /** Oturum açıkken şifre değiştirme. Mevcut şifre şart. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      throw new BadRequestException('Bu hesapta şifre tanımlı değil');
    }
    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new BadRequestException('Mevcut şifre yanlış');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }) },
    });
    // Şifre değiştirmenin amacı da çoğu zaman "diğerlerini at" olduğu için
    // buradaki oturum dahil hepsi kapanıyor; istemci yeniden giriş yapıyor.
    await this.sessions.revokeAllForUser(userId);
  }

  /**
   * Hesabı ve bağlı bütün verisini siler.
   *
   * ZORUNLU: Apple App Store, hesap açmaya izin veren uygulamanın hesabı
   * uygulama içinden silmeye de izin vermesini şart koşuyor (5.1.1(v)).
   * Google Play'in de benzer bir gereği var. Yani bu bir incelik değil,
   * yayın engeli.
   *
   * GERÇEKTEN siliniyor (yumuşak silme değil): cüzdan, defter, koleksiyon,
   * maçlar, cihazlar — hepsi `onDelete: Cascade` ile gidiyor. Gerçek parayla
   * satın alma eklendiğinde bu karar YENİDEN ELE ALINMALI: o zaman iade ve
   * muhasebe için satın alma kayıtlarının kimliksizleştirilmiş hâlde
   * saklanması gerekecek.
   *
   * Misafir hesap da silinebiliyor: şifresi yok, o yüzden onay şifre yerine
   * istemcideki açık bir uyarıyla alınıyor.
   */
  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Hesap bulunamadı');

    if (user.passwordHash) {
      if (!password) throw new BadRequestException('Hesabı silmek için şifreni gir');
      if (!(await argon2.verify(user.passwordHash, password))) {
        throw new BadRequestException('Şifre yanlış');
      }
    }

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`Hesap silindi: ${userId}`);
  }
}
