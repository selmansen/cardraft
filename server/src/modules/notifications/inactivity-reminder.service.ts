import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../../infrastructure/notification/notification.port.js';
import { QUEUE_PORT, type QueuePort } from '../../infrastructure/queue/queue.port.js';

/** Bu süredir görülmeyen oyuncuya hatırlatma gider. */
const INACTIVITY_HOURS = 24;
/** Hatırlatma tekrarı: aynı kişiye her saat bildirim gitmesin diye. */
const REMINDER_COOLDOWN_HOURS = 72;
const TOPIC = 'notifications.inactivity-reminder';

/**
 * "Bir gündür uğramadın" hatırlatması.
 *
 * TASARIM: her saat çalışan TEK bir zamanlanmış iş, uygun kullanıcıları toplu
 * bulup gönderiyor. Alternatif, her kullanıcı için ayrı bir gecikmeli iş
 * planlamaktı (kullanıcı her girişte kendi işini 24 saat ileri atar). Onu
 * seçmedik: kullanıcı sayısı kadar zamanlanmış iş demek, ve her aktivitede
 * eski işi bulup iptal etmek gerekiyordu. Toplu tarama tek iş, tek sorgu ve
 * çok daha az hareketli parça.
 *
 * Kuyruğun ilk gerçek kullanımı da bu — adapter'ı yazmıştık ama hiçbir iş
 * ona uğramıyordu.
 */
@Injectable()
export class InactivityReminderService implements OnModuleInit {
  private readonly logger = new Logger(InactivityReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
  ) {}

  async onModuleInit(): Promise<void> {
    // İşleyiciyi kaydet, sonra saatlik taramayı kur. Sıra önemli: zamanlama
    // önce kurulsaydı, işleyici hazır olmadan bir iş tetiklenebilirdi.
    await this.queue.process(TOPIC, async () => {
      await this.run();
    });
    await this.queue.schedule(TOPIC, '0 * * * *', {});
  }

  /** Zamanlanmış işin gövdesi — testten de doğrudan çağrılabilsin diye ayrı. */
  async run(): Promise<{ notified: number }> {
    const threshold = new Date(Date.now() - INACTIVITY_HOURS * 3_600_000);
    const cooldown = new Date(Date.now() - REMINDER_COOLDOWN_HOURS * 3_600_000);

    /**
     * Kimlere gidecek: en son görüldüğü an eşiğin gerisinde kalmış, iptal
     * edilmemiş bir push jetonu olan ve yakın zamanda zaten hatırlatılmamış
     * cihazlar.
     *
     * Sorgu cihaz üzerinden çünkü "son görülme" bilgisi orada tutuluyor
     * (Device.lastSeenAt, her uygulama açılışında güncelleniyor).
     */
    const devices = await this.prisma.device.findMany({
      where: {
        lastSeenAt: { lt: threshold },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: cooldown } }],
        pushTokens: { some: { revokedAt: null } },
      },
      select: {
        id: true,
        userId: true,
        pushTokens: { where: { revokedAt: null }, select: { fcmToken: true } },
      },
      take: 500,
    });

    if (devices.length === 0) return { notified: 0 };

    let notified = 0;
    for (const device of devices) {
      const result = await this.notifications.send(
        { userId: device.userId, tokens: device.pushTokens.map((t) => t.fcmToken) },
        {
          title: 'Garajın seni bekliyor',
          body: 'Günlük görevlerin hazır. Bir maç yapıp ödülünü al!',
          data: { screen: 'home' },
        },
      );
      notified += result.sent;

      // FCM "bu jeton artık geçerli değil" dediyse kaydı düşür — ölü jetonlara
      // her saat tekrar denemenin anlamı yok.
      if (result.invalidTokens.length > 0) {
        await this.prisma.pushToken.updateMany({
          where: { fcmToken: { in: result.invalidTokens } },
          data: { revokedAt: new Date() },
        });
      }

      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastReminderAt: new Date() },
      });
    }

    this.logger.log(`Hatırlatma gönderildi: ${notified} cihaz`);
    return { notified };
  }
}
