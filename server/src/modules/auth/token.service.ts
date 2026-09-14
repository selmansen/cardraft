import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

import { TypedConfigService } from '../../config/app-config.module.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { AuthTokensDto } from './dto/auth.dto.js';

/** Access token'ın içindeki veri. Kısa tutuluyor: token her istekte gidiyor. */
export interface AccessTokenPayload {
  sub: string;
  isGuest: boolean;
}

interface UserLike {
  id: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
}

/**
 * Oturum jetonlarının üretimi, doğrulanması ve döndürülmesi.
 *
 * TASARIM KARARI — access JWT, refresh opaque (rastgele dize):
 *
 * Access token JWT çünkü her istekte doğrulanması gerekiyor ve JWT'nin imzası
 * bunu veritabanına gitmeden mümkün kılıyor; karşılığında iptal edilemiyor,
 * bu yüzden ömrü kısa (15dk).
 *
 * Refresh token JWT DEĞİL. JWT olsaydı "iptal edilemez" özelliği burada
 * zarara dönüşürdü: çalınan bir refresh token 30 gün boyunca sınırsız yeni
 * access token üretirdi ve durduramazdık. Bunun yerine yüksek entropili
 * rastgele bir dize üretip veritabanında SADECE hash'ini tutuyoruz. Böylece:
 *   - her yenilemede eskisini iptal edip yenisini verebiliyoruz (rotasyon),
 *   - "tüm cihazlardan çıkış" tek bir UPDATE,
 *   - veritabanı sızsa bile token'ların kendisi orada değil.
 *
 * Hash için SHA-256 yeterli (argon2 değil): argon2'nin yavaşlığı, düşük
 * entropili şifreleri kaba kuvvetten korumak içindir. Burada değer 256 bit
 * rastgele — kaba kuvvet zaten imkânsız, her istekte argon2 çalıştırmak ise
 * yenileme uç noktasını gereksiz yavaşlatırdı.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: TypedConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * "15m" / "30d" gibi okunabilir süreleri saniyeye çevirir.
   *
   * Env'de saniye yerine bu biçimi tutuyoruz çünkü `2592000` bakan kimseye
   * bir şey söylemiyor, `30d` söylüyor. Çevrim tek yerde: access ve refresh
   * için ayrı ayrı yazılsaydı aynı ayrıştırma mantığı iki kopya olurdu.
   * Biçimin geçerliliği zaten env şemasında (regex) garanti altında.
   */
  private static toSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) throw new Error(`Süre biçimi geçersiz: ${ttl}`);
    const unitSeconds = { s: 1, m: 60, h: 3_600, d: 86_400 }[match[2]]!;
    return Number(match[1]) * unitSeconds;
  }

  /**
   * Bir kullanıcı için yeni jeton çifti üretir ve refresh'i kaydeder.
   * Giriş, kayıt, misafir giriş ve yenileme — hepsi buraya çıkıyor, jeton
   * üretme mantığı dört yerde tekrarlanmıyor.
   */
  async issue(user: UserLike, deviceId?: string): Promise<AuthTokensDto> {
    const payload: AccessTokenPayload = { sub: user.id, isGuest: user.isGuest };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      // Saniye olarak veriliyor: jsonwebtoken'ın string biçimi kendi dar
      // tipini dayatıyor, sayı hem tipli hem belirsizlik bırakmıyor.
      expiresIn: TokenService.toSeconds(this.config.get('JWT_ACCESS_TTL')),
    });

    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        deviceId: deviceId ?? null,
        expiresAt: new Date(
          Date.now() + TokenService.toSeconds(this.config.get('JWT_REFRESH_TTL')) * 1_000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isGuest: user.isGuest,
      },
    };
  }

  /**
   * Refresh rotasyonu: eski jetonu iptal eder, yenisini verir.
   *
   * Rotasyon neden: aynı refresh token'ı tekrar tekrar kullanmak, çalındığında
   * hırsıza süresiz erişim demek. Her kullanımda değiştirirsek çalınan jeton
   * en fazla bir kez işe yarar; üstelik iptal edilmiş bir jetonun tekrar
   * kullanılması "bu hesap ele geçirilmiş olabilir" sinyalidir (şimdilik
   * sadece reddediyoruz, ileride tüm oturumları düşürmek için kanca burası).
   */
  async rotate(refreshToken: string): Promise<AuthTokensDto> {
    const tokenHash = this.hash(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.revokedAt !== null || existing.expiresAt < new Date()) {
      // Hangi sebeple reddedildiğini istemciye AYRINTILANDIRMIYORUZ: "süresi
      // dolmuş" ile "böyle bir jeton yok" arasındaki fark, saldırgana geçerli
      // jeton aradığında geri bildirim verir.
      throw new UnauthorizedException('Oturum geçersiz, tekrar giriş yapın');
    }

    // Sıra bilinçli: ÖNCE iptal, SONRA yeni jeton. Tersi olsaydı ve iptal
    // adımı hata verseydi ortada aynı anda geçerli iki refresh token kalırdı
    // — rotasyonun engellemek için var olduğu durumun ta kendisi. Bu sırada
    // ise en kötü ihtimalle kullanıcı bir kez yeniden giriş yapar.
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issue(existing.user, existing.deviceId ?? undefined);
  }

  /** Tek oturumu kapatır (çıkış). */
  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Kullanıcının tüm oturumlarını kapatır (şifre değişimi, hesap devri). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
