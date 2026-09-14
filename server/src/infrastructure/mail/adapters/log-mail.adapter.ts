import { Injectable, Logger } from '@nestjs/common';

import type { MailMessage, MailPort } from '../mail.port.js';

/**
 * Geliştirme adapter'ı: e-postayı göndermez, loglar.
 *
 * Bağlantıyı test etmek için değil, AKIŞI test etmek için: doğrulama
 * bağlantısı loga düştüğü sürece kayıt → doğrulama → giriş zinciri baştan
 * sona denenebiliyor, hiçbir sağlayıcı hesabı olmadan.
 *
 * Üretimde bunun aktif kalması sessiz bir arıza olurdu — oyuncu şifresini
 * sıfırlayamaz ve kimse fark etmez — bu yüzden üretimde açıkça uyarıyor.
 */
@Injectable()
export class LogMailAdapter implements MailPort {
  private readonly logger = new Logger(LogMailAdapter.name);

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `E-POSTA (gönderilmedi, yalnızca log)\n` +
        `  Alıcı : ${message.to}\n` +
        `  Konu  : ${message.subject}\n` +
        `  Gövde : ${message.text.replace(/\n/g, '\n          ')}`,
    );
    return Promise.resolve();
  }
}
