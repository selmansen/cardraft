import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';

import { IdentityProvider } from '../../generated/prisma/enums.js';
import { IDENTITY_VERIFIER, type IdentityVerifier } from '../../infrastructure/identity/identity.port.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { DevicesService } from '../devices/devices.service.js';
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
    @Inject(IDENTITY_VERIFIER) private readonly verifier: IdentityVerifier,
  ) {}

  /**
   * Sağlayıcı kimliğiyle giriş/bağlama. Çağıran her zaman oturum açmış
   * durumda (uygulama açılışta misafir hesap alıyor), bu yüzden üç durum var:
   *
   * 1. Kimlik zaten BU kullanıcıya bağlı → sadece yeni jeton.
   * 2. Kimlik hiç kayıtlı değil → mevcut (misafir) hesaba bağlanır. İlerleme
   *    olduğu gibi kalır — ADR 0005'teki "aynı satırda yükseltme" kararı.
   * 3. Kimlik BAŞKA bir kullanıcıya bağlı → o hesaba geçilir. Bu, cihaz
   *    değiştiren oyuncunun hesabını geri aldığı durum; asıl amaç bu.
   *    Ama buradaki misafir hesabın ilerlemesi varsa sessizce kaybolmamalı:
   *    `force` gelmediği sürece 409 dönüyor ve istemci uyarıyor.
   */
  async signIn(
    userId: string,
    provider: IdentityProvider,
    idToken: string,
    device: DeviceInfoDto,
    force = false,
  ): Promise<AuthTokensDto> {
    const verified = await this.verifier.verify(provider, idToken);

    const existing = await this.prisma.userIdentity.findUnique({
      where: { provider_subject: { provider, subject: verified.subject } },
      select: { userId: true },
    });

    // 1 & 3 — kimlik zaten kayıtlı.
    if (existing) {
      if (existing.userId !== userId) {
        if (!force && (await this.hasProgress(userId))) {
          throw new ConflictException(
            'Bu hesap başka bir CarDraft hesabına bağlı. O hesaba geçersen buradaki ilerlemen kaybolur.',
          );
        }
        this.logger.log(`Hesap devralındı: ${userId} → ${existing.userId}`);
      }
      return this.issueFor(existing.userId, device);
    }

    // 2 — yeni kimlik, mevcut hesaba bağlanıyor.
    await this.prisma.$transaction(async (tx) => {
      await tx.userIdentity.create({
        data: { userId, provider, subject: verified.subject, email: verified.email },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          isGuest: false,
          // Sağlayıcının e-postası yalnızca BOŞSA yazılıyor: oyuncu ikinci bir
          // sağlayıcı bağladığında ilk adresin üzerine yazmak, destek
          // yazışmalarında yanlış adrese ulaşmak demek olurdu.
          ...(verified.email ? { email: verified.email } : {}),
        },
      });
    });

    return this.issueFor(userId, device);
  }

  /**
   * Hesabın kaybedilecek bir şeyi var mı?
   *
   * Başlangıç kartları ve kayıt bonusu sayılmıyor — onlar her hesapta var ve
   * "ilerleme" değil. Ölçüt: oynanmış maç ya da sonradan edinilmiş kart.
   */
  private async hasProgress(userId: string): Promise<boolean> {
    const [stats, acquired] = await Promise.all([
      this.prisma.userStats.findUnique({ where: { userId }, select: { battlesPlayed: true } }),
      this.prisma.ownedCard.count({ where: { userId, source: { not: 'STARTER' } } }),
    ]);
    return (stats?.battlesPlayed ?? 0) > 0 || acquired > 0;
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
