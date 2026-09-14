/**
 * Kuyruk soyutlaması (Ports & Adapters / Hexagonal mimarinin "port"u).
 *
 * NEDEN BÖYLE:
 * İş mantığının bilmesi gereken tek şey "bu işi arka plana at". Hangi
 * teknolojinin taşıdığı (BullMQ, RabbitMQ, Kafka, SQS) bir ALTYAPI kararıdır
 * ve zamanla değişir. Servisler doğrudan BullMQ'nun `Queue` sınıfını
 * enjekte etseydi, teknoloji değişimi onlarca dosyayı değiştirmek demek
 * olurdu — üstelik hiçbiri iş kuralı değişmediği halde.
 *
 * SOLID karşılığı:
 * - DIP (Bağımlılığı Tersine Çevirme): üst seviye modül (iş mantığı) alt
 *   seviye modüle (BullMQ) değil, ikisi de bu arayüze bağlı. Bağımlılık oku
 *   somuttan soyuta doğru dönüyor.
 * - OCP (Açık/Kapalı): yeni bir taşıyıcı eklemek = yeni bir adapter sınıfı.
 *   Mevcut hiçbir iş kodu değişmiyor.
 * - ISP (Arayüz Ayrımı): arayüz üç metotla sınırlı; BullMQ'nun yüzlerce
 *   yeteneği buraya sızmıyor, çünkü iş mantığının onlara ihtiyacı yok.
 *
 * Şu an tek adapter var (BullMQ) ve bu bilinçli: soyutlama "ileride lazım
 * olur" diye değil, taşıyıcının değişeceği BİLİNDİĞİ için yazıldı. Bilinmese
 * erken soyutlama olurdu ve maliyeti faydasını aşardı.
 */

/** Enjeksiyon token'ı: arayüzler TypeScript'te çalışma zamanında var olmaz,
 *  bu yüzden DI konteynerinin tutunabileceği somut bir sembol gerekiyor. */
export const QUEUE_PORT = Symbol('QUEUE_PORT');

export interface EnqueueOptions {
  /** İşin başlamadan önce bekleyeceği süre (ms). */
  delayMs?: number;
  /** Başarısızlıkta kaç kez yeniden denensin. */
  attempts?: number;
  /**
   * Aynı kimlikle ikinci kez eklenen iş yok sayılır. Ödeme/ödül gibi
   * "yanlışlıkla iki kez çalışmamalı" işler için — ekonomi diliminde
   * doğrudan buna dayanacağız.
   */
  idempotencyKey?: string;
}

export type JobHandler<T> = (payload: T) => Promise<void>;

export interface QueuePort {
  /** Bir işi kuyruğa bırakır. */
  enqueue<T>(topic: string, payload: T, options?: EnqueueOptions): Promise<void>;

  /** Bir konudaki işleri işleyecek fonksiyonu kaydeder. */
  process<T>(topic: string, handler: JobHandler<T>): Promise<void>;

  /**
   * Tekrar eden iş (cron). Tek seferlik `enqueue`'dan ayrı bir metot çünkü
   * semantiği farklı: burada "her X'te bir çalışsın" deniyor ve aynı isimle
   * ikinci kez çağrılmak işi ÇOĞALTMAMALI (uygulama her açılışta bunu
   * çağıracak). Adapter bu tekilliği garanti ediyor.
   */
  schedule<T>(topic: string, cron: string, payload: T): Promise<void>;

  /** Kuyruğun sağlıklı olup olmadığı (health endpoint'i için). */
  isHealthy(): Promise<boolean>;
}
