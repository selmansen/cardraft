/**
 * Bildirim gönderimi soyutlaması — kuyruktakiyle aynı port/adapter deseni.
 *
 * NEDEN SOYUTLAMA:
 * Bugün Firebase (FCM) kullanacağız, ama iki somut sebep var:
 *  1. Firebase kimlik bilgileri henüz yok. Soyutlama sayesinde bildirim
 *     mantığını (kime, ne zaman, ne yazacak) ŞİMDİ yazıp test edebiliyoruz;
 *     gerçek gönderim gelince değişen tek şey hangi adapter'ın bağlandığı.
 *  2. Geliştirirken kimsenin telefonuna gerçek bildirim gitmemeli. Log
 *     adapter'ı bunu bedavaya veriyor.
 *
 * ISP gereği arayüz dar: iş mantığının ihtiyacı "şu kullanıcıya şunu gönder".
 * FCM'in konu abonelikleri, veri yükü biçimleri gibi ayrıntıları buraya
 * sızmıyor — onlar adapter'ın içinde kalıyor.
 */
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface PushMessage {
  title: string;
  body: string;
  /** İstemcinin bildirime dokununca nereye gideceğini bilmesi için. */
  data?: Record<string, string>;
}

export interface PushTarget {
  userId: string;
  /** Kullanıcının kayıtlı, iptal edilmemiş FCM jetonları. */
  tokens: string[];
}

export interface PushResult {
  sent: number;
  /** FCM'in "bu jeton artık geçersiz" dedikleri — kayıttan düşürülecek. */
  invalidTokens: string[];
}

export interface NotificationPort {
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}
