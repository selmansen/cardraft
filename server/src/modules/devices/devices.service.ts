import { Injectable, NotFoundException } from '@nestjs/common';

import type { DeviceInfoDto } from '../../common/dto/device-info.dto.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * Cihaz kaydı ve push jetonu yönetimi.
 *
 * Neden ayrı bir modül: bugün sadece kayıt tutuyor ama yakında bildirim
 * gönderimi (FCM), "bu cihazdan çıkış yap" ve cihaz bazlı oturum listesi de
 * buraya gelecek. Auth'un içine gömseydik auth modülü iki işten sorumlu
 * olurdu — SRP'nin modül seviyesindeki karşılığı bu.
 */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cihazı kaydeder ya da günceller.
   *
   * upsert, "önce bak sonra yaz" ikilisinin yerine geçiyor. Fark sadece
   * kısalık değil: iki adımlı hâlde aynı kullanıcı iki cihazdan aynı anda
   * giriş yaparsa iki istek de "yok" görüp ikisi de eklemeye çalışır ve biri
   * benzersizlik kısıtına takılır (race condition). upsert bunu veritabanı
   * seviyesinde tek atomik işleme indiriyor.
   */
  async register(userId: string, info: DeviceInfoDto) {
    return this.prisma.device.upsert({
      where: {
        userId_installationId: { userId, installationId: info.installationId },
      },
      create: {
        userId,
        installationId: info.installationId,
        platform: info.platform,
        appVersion: info.appVersion ?? null,
      },
      update: {
        platform: info.platform,
        appVersion: info.appVersion ?? null,
        lastSeenAt: new Date(),
      },
      select: { id: true, platform: true, installationId: true, lastSeenAt: true },
    });
  }

  /**
   * Cihaza ait FCM jetonunu kaydeder.
   *
   * Jeton başka bir cihaza taşınmış olabilir (kullanıcı hesap değiştirdi,
   * uygulama yeniden kuruldu): fcmToken benzersiz olduğu için upsert onu
   * yeni cihaza bağlıyor. Aksi hâlde bildirim yanlış kişiye giderdi.
   */
  async savePushToken(deviceId: string, fcmToken: string) {
    return this.prisma.pushToken.upsert({
      where: { fcmToken },
      create: { deviceId, fcmToken },
      update: { deviceId, revokedAt: null },
      select: { id: true, deviceId: true, updatedAt: true },
    });
  }

  /** Kullanıcının cihazları — "oturum açık cihazlar" ekranı için. */
  async listForUser(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        platform: true,
        installationId: true,
        appVersion: true,
        lastSeenAt: true,
      },
    });
  }

  /**
   * Cihaz kaydını siler. `userId` koşulu güvenlik için: kimliği doğrulanmış
   * olmak, BAŞKASININ cihazını silme hakkı vermez. Bu kontrol olmadan uç
   * nokta bir IDOR açığı (başkasının kaynağına id tahmin ederek erişme)
   * olurdu.
   */
  async remove(userId: string, deviceId: string): Promise<void> {
    const result = await this.prisma.device.deleteMany({
      where: { id: deviceId, userId },
    });
    if (result.count === 0) throw new NotFoundException('Cihaz bulunamadı');
  }
}
