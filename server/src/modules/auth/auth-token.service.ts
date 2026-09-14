import { createHash, randomBytes } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { TokenPurpose } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * Jeton ömürleri.
 *
 * Doğrulama uzun (24 saat): oyuncu e-postasını ertesi gün açabilir ve
 * doğrulamamış olmak oyunu engellemiyor, yani acele ettirmenin anlamı yok.
 * Sıfırlama kısa (1 saat): o bağlantı hesabın kendisidir — e-posta kutusu bir
 * süreliğine başkasının eline geçse bile pencere dar olsun.
 */
const TTL_SECONDS: Record<TokenPurpose, number> = {
  [TokenPurpose.EMAIL_VERIFICATION]: 24 * 60 * 60,
  [TokenPurpose.PASSWORD_RESET]: 60 * 60,
};

/**
 * Tek kullanımlık, süreli jetonlar — doğrulama ve şifre sıfırlama için.
 *
 * İkisi tek serviste çünkü kuralları birebir aynı: rastgele üret, hash'ini
 * sakla, bir kez kullan, süresi dolunca reddet. Ayrı ayrı yazılsaydı biri
 * düzeltildiğinde diğeri geride kalırdı.
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Yeni jeton üretir ve ÖNCEKİ kullanılmamış jetonları geçersiz kılar.
   *
   * Geçersiz kılma önemli: oyuncu "tekrar gönder"e üç kez bastığında üç
   * geçerli sıfırlama bağlantısı ortalıkta dolaşmamalı. Eski e-postalardaki
   * bağlantılar ölü olmalı, en son gönderilen çalışmalı.
   *
   * Dönen değer jetonun DÜZ HÂLİ — veritabanına yalnızca hash'i yazılıyor,
   * yani bu değer bu çağrıdan sonra bir daha hiçbir yerden okunamaz.
   */
  async issue(userId: string, purpose: TokenPurpose): Promise<string> {
    // 32 bayt: kaba kuvvetle bulunamayacak kadar geniş, URL'de taşınabilecek
    // kadar kısa. base64url çünkü bağlantıda kodlama gerektirmiyor.
    const token = randomBytes(32).toString('base64url');

    await this.prisma.$transaction(async (tx) => {
      await tx.authToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.authToken.create({
        data: {
          userId,
          purpose,
          tokenHash: this.hash(token),
          expiresAt: new Date(Date.now() + TTL_SECONDS[purpose] * 1000),
        },
      });
    });

    return token;
  }

  /**
   * Jetonu doğrular ve TÜKETİR (bir daha kullanılamaz).
   *
   * Geçersiz, süresi dolmuş ve kullanılmış jetonlar için AYNI mesaj dönüyor:
   * ayrı mesajlar, elindeki jetonun var olup olmadığını deneyerek öğrenmeye
   * yarardı.
   */
  async consume(token: string, purpose: TokenPurpose): Promise<string> {
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });

    const invalid =
      !record ||
      record.purpose !== purpose ||
      record.usedAt !== null ||
      record.expiresAt.getTime() < Date.now();

    if (invalid) {
      throw new BadRequestException('Bağlantı geçersiz ya da süresi dolmuş. Yenisini iste.');
    }

    // Tüketim koşullu: `usedAt: null` şartı, aynı anda gelen iki isteğin
    // ikisinin de başarılı olmasını engelliyor (yarış koşulu).
    const consumed = await this.prisma.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new BadRequestException('Bağlantı geçersiz ya da süresi dolmuş. Yenisini iste.');
    }

    return record.userId;
  }
}
