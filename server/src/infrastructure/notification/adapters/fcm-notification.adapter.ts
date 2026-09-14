import { Injectable, Logger } from '@nestjs/common';

import type {
  NotificationPort,
  PushMessage,
  PushResult,
  PushTarget,
} from '../notification.port.js';

/**
 * Firebase Cloud Messaging adapter'ı — İSKELET.
 *
 * Henüz bağlanmadı çünkü Firebase projesi ve servis hesabı anahtarı yok.
 * Buraya konması bilinçli: gerçek gönderime geçildiğinde dokunulacak TEK
 * dosyanın hangisi olduğu şimdiden belli olsun, ve iş mantığının bu sınıfa
 * hiç bağlı olmadığı görülsün (bağlantı sadece NotificationModule'de).
 *
 * Tamamlanınca yapılacaklar:
 *  - firebase-admin kur, servis hesabı anahtarını env'den oku
 *  - sendEachForMulticast ile toplu gönder
 *  - 'messaging/registration-token-not-registered' dönen jetonları
 *    invalidTokens olarak döndür (çağıran taraf kaydı düşürüyor)
 */
@Injectable()
export class FcmNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(FcmNotificationAdapter.name);

  async send(_target: PushTarget, _message: PushMessage): Promise<PushResult> {
    throw new Error(
      'FCM adapter henüz yapılandırılmadı — Firebase servis hesabı anahtarı gerekli',
    );
  }
}
