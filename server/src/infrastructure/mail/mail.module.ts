import { Global, Module } from '@nestjs/common';

import { LogMailAdapter } from './adapters/log-mail.adapter.js';
import { MAIL_PORT } from './mail.port.js';

/**
 * Gönderim yolunun seçildiği tek yer.
 *
 * Bir sağlayıcı (Resend/SES/Postmark) seçildiğinde değişecek tek satır
 * aşağıdaki `useClass`. Ortama göre seçim gerektiğinde (üretimde gerçek
 * sağlayıcı, geliştirmede log) `useFactory`'ye çevrilir — yine burada.
 */
@Global()
@Module({
  providers: [{ provide: MAIL_PORT, useClass: LogMailAdapter }],
  exports: [MAIL_PORT],
})
export class MailModule {}
