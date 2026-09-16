import { Inject, Injectable, Logger } from '@nestjs/common';

import { CurrencyCode, IdentityProvider, LedgerReason } from '../../generated/prisma/enums.js';
import { IDENTITY_VERIFIER, type IdentityVerifier } from '../../infrastructure/identity/identity.port.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { EconomyService } from '../economy/economy.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SIGNUP_BONUS_RIM } from '../economy/reward.rules.js';
import type { DeviceInfoDto } from '../../common/dto/device-info.dto.js';
import type { AuthTokensDto } from './dto/auth.dto.js';
import { TokenService } from './token.service.js';

/**
 * Apple / Google ile giriş.
 *
 * Tek giriş yolu bu (e-posta + şifre kaldırıldı): şifre olmayınca şifre
 * sıfırlama, doğrulama, kaba kuvvet ve hesap sayımı yüzeyleri de olmuyor.
 * Sağlayıcı hem kimliği doğruluyor hem e-postayı — ikisini de bizim
 * yapmamızdan daha iyi yapıyor.
 *
 * Misafir hesap KALIYOR: oyuncu hiçbir şey yazmadan oynamaya devam ediyor.
 * Sağlayıcı girişi bir duvar değil, bir KURTARMA aracı — "ilerlemeni bu
 * cihaza bağlı bırakma" teklifi.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly devices: DevicesService,
    private readonly economy: EconomyService,
    private readonly inventory: InventoryService,
    @Inject(IDENTITY_VERIFIER) private readonly verifier: IdentityVerifier,
  ) {}

  /**
   * Sağlayıcı kimliğiyle giriş/bağlama.
   *
   * Oturum genelde var (uygulama açılışta misafir hesap alıyor) ama ŞART
   * değil — bkz. AuthController'daki @OptionalAuth gerekçesi. Dört durum:
   *
   * 1. Kimlik zaten BU kullanıcıya bağlı → sadece yeni jeton.
   * 2. Kimlik hiç kayıtlı değil, oturum VAR → mevcut (misafir) hesaba
   *    bağlanır. İlerleme olduğu gibi kalır — ADR 0005'teki "aynı satırda
   *    yükseltme" kararı.
   * 3. Kimlik BAŞKA bir kullanıcıya bağlı → o hesaba geçilir. Cihaz
   *    değiştiren oyuncunun hesabını geri aldığı durum; asıl amaç bu.
   * 4. Kimlik kayıtlı değil ve oturum YOK → yeni bir hesap açılır. Yükseltilecek
   *    bir misafir yok, yani bu kişi oyuna buradan başlıyor: başlangıç
   *    kartları ve hoş geldin hediyesi veriliyor.
   */
  async signIn(
    userId: string | null,
    provider: IdentityProvider,
    idToken: string,
    device: DeviceInfoDto,
  ): Promise<AuthTokensDto> {
    const verified = await this.verifier.verify(provider, idToken);

    const existing = await this.prisma.userIdentity.findUnique({
      where: { provider_subject: { provider, subject: verified.subject } },
      select: { userId: true },
    });

    // 1 & 3 — kimlik zaten kayıtlı: o hesaba geçiliyor.
    //
    // Onay sorulmuyor ve sorulması da gerekmiyor: misafir hesapta cüzdan 0 ve
    // koleksiyon yalnızca başlangıç kartlarından ibaret, yani geride bırakılan
    // bir şey yok. Bu, misafirin hiçbir şey biriktirmemesi kararının doğrudan
    // kazancı — bir onay diyaloğu, bir `force` bayrağı ve iki hesabı
    // birleştirme sorusu birden ortadan kalkıyor.
    if (existing) {
      if (existing.userId !== userId) {
        this.logger.log(`Hesaba dönüldü: ${userId ?? 'oturumsuz'} → ${existing.userId}`);
      }
      return this.issueFor(existing.userId, device);
    }

    // 4 — kimlik yeni ve yükseltilecek bir oturum yok: sıfırdan hesap.
    if (!userId) {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            isGuest: false,
            // Çakışma kontrolü burada gereksiz: yeni satır yazılıyor ve
            // e-posta benzersizse sorun yok. Benzersiz değilse aşağıdaki
            // catch değil, doğrudan e-postasız devam etmek gerekir — bu
            // yüzden önce bakıyoruz.
            ...(verified.email && !(await tx.user.findFirst({ where: { email: verified.email } }))
              ? { email: verified.email }
              : {}),
          },
          select: { id: true },
        });
        await tx.userIdentity.create({
          data: { userId: user.id, provider, subject: verified.subject, email: verified.email },
        });
        return user;
      });
      // Başlangıç kartları olmadan maça çıkılamıyor; hoş geldin hediyesi de
      // misafirden yükselen oyuncuyla aynı.
      await this.inventory.grantStarters(created.id);
      await this.economy.move({
        userId: created.id,
        currency: CurrencyCode.RIM,
        amount: SIGNUP_BONUS_RIM,
        reason: LedgerReason.SIGNUP_BONUS,
        idempotencyKey: `signup:${created.id}`,
      });
      this.logger.log(`Oturumsuz girişten yeni hesap: ${created.id}`);
      return this.issueFor(created.id, device);
    }

    // 2 — yeni kimlik, mevcut misafir hesaba bağlanıyor.
    const wasGuest = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true },
    });

    /**
     * E-posta BAŞKA bir hesapta kayıtlı olabilir.
     *
     * `users.email` benzersiz ve sağlayıcının verdiği adres bir başkasının
     * satırında duruyorsa yazma denemesi patlıyordu — oyuncu 500 görüyor ve
     * girişi hiç yapamıyordu. Oysa e-posta kimliğin kendisi DEĞİL: gerçek
     * kimlik `(provider, subject)` ikilisi ve o benzersizliği zaten
     * `user_identities` sağlıyor. E-posta yalnızca destek yazışması için
     * tutulan bir kolaylık.
     *
     * Bu yüzden çakışma girişi engellemiyor, sadece e-posta yazılmıyor.
     * Kimlik satırında zaten saklanıyor (`UserIdentity.email`), yani bilgi
     * kaybolmuyor.
     */
    const emailTaken = verified.email
      ? await this.prisma.user.findFirst({
          where: { email: verified.email, id: { not: userId } },
          select: { id: true },
        })
      : null;

    if (emailTaken) {
      this.logger.warn(
        `Sağlayıcı e-postası başka hesapta kayıtlı, kullanıcı satırına yazılmadı: ${verified.email}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userIdentity.create({
        data: { userId, provider, subject: verified.subject, email: verified.email },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          isGuest: false,
          // Sağlayıcının e-postası yalnızca boşsa ve başkasında değilse
          // yazılıyor: oyuncu ikinci bir sağlayıcı bağladığında ilk adresin
          // üzerine yazmak, destek yazışmalarında yanlış adrese ulaşmak
          // demek olurdu.
          ...(verified.email && !emailTaken ? { email: verified.email } : {}),
        },
      });
    });

    /**
     * Hoş geldin hediyesi — hesap ilk kez bağlandığında.
     *
     * `idempotencyKey` sayesinde ikinci bir sağlayıcı bağlayan oyuncu bonusu
     * tekrar almıyor; defter zaten aynı anahtarla ikinci kayıt kabul etmiyor.
     */
    if (wasGuest?.isGuest) {
      await this.economy.move({
        userId,
        currency: CurrencyCode.RIM,
        amount: SIGNUP_BONUS_RIM,
        reason: LedgerReason.SIGNUP_BONUS,
        idempotencyKey: `signup:${userId}`,
      });
    }

    return this.issueFor(userId, device);
  }


  private async issueFor(userId: string, info: DeviceInfoDto): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, isGuest: true },
    });
    const device = await this.devices.register(userId, info);
    return this.tokens.issue(user, device.id);
  }

}
