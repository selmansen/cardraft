import { Injectable, Logger } from '@nestjs/common';

import type {
  NotificationPort,
  PushMessage,
  PushResult,
  PushTarget,
} from '../notification.port.js';

/**
 * Geliştirme adapter'ı: bildirimi göndermez, loglar.
 *
 * Firebase kimlik bilgileri gelene kadar kullanılacak olan bu. Sahte bir
 * "başarılı" cevabı döndürüyor ki üstündeki iş mantığı (kime/ne zaman
 * gönderileceği) gerçek gönderim olmadan da uçtan uca çalıştırılabilsin.
 */
@Injectable()
export class LogNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger('Notification');

  async send(target: PushTarget, message: PushMessage): Promise<PushResult> {
    this.logger.log(
      `[GÖNDERİLMEDİ - log adapter] user=${target.userId.slice(0, 8)} ` +
        `cihaz=${target.tokens.length} · "${message.title}: ${message.body}"`,
    );
    return { sent: target.tokens.length, invalidTokens: [] };
  }
}
