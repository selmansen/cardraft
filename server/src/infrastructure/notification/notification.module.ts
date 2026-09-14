import { Global, Module } from '@nestjs/common';

import { LogNotificationAdapter } from './adapters/log-notification.adapter.js';
import { NOTIFICATION_PORT } from './notification.port.js';

/**
 * Gönderim yolunun seçildiği tek yer.
 *
 * Firebase hazır olduğunda `useClass` değeri `FcmNotificationAdapter` olacak;
 * başka hiçbir dosya değişmeyecek. Ortama göre seçim de mümkün (üretimde FCM,
 * geliştirmede log) — o gerektiğinde `useFactory`'ye çevrilir, yine burada.
 */
@Global()
@Module({
  providers: [{ provide: NOTIFICATION_PORT, useClass: LogNotificationAdapter }],
  exports: [NOTIFICATION_PORT],
})
export class NotificationModule {}
