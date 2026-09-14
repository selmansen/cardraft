export const MAIL_PORT = Symbol('MAIL_PORT');

export interface MailMessage {
  to: string;
  subject: string;
  /** Düz metin gövde — her istemci gösterebilir, HTML'siz de okunabilir olmalı. */
  text: string;
  /** İsteğe bağlı HTML gövde. */
  html?: string;
}

/**
 * E-posta gönderimi — sağlayıcının arkasına saklandığı kapı.
 *
 * Kuyruk ve bildirimde olduğu gibi adapter deseni: bugün hangi servisi
 * kullanacağımız belli değil (Resend, SES, Postmark…) ve o karar bir hesap
 * açmayı gerektiriyor. Port sayesinde karar ertelenebiliyor — doğrulama ve
 * şifre sıfırlama akışları bugün yazılıp test edilebiliyor, sağlayıcı
 * geldiğinde değişen tek şey `mail.module.ts`'teki `useClass` satırı olacak.
 *
 * Servisler bu arayüzü çağırıyor, hiçbiri "e-posta göndermek" dışında bir şey
 * bilmiyor: ne SMTP, ne API anahtarı, ne şablon motoru.
 */
export interface MailPort {
  send(message: MailMessage): Promise<void>;
}
