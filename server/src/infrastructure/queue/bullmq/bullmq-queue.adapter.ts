import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';

import { TypedConfigService } from '../../../config/app-config.module.js';
import type { EnqueueOptions, JobHandler, QueuePort } from '../queue.port.js';

/**
 * QueuePort'un BullMQ ile gerçeklenmesi (adapter).
 *
 * BullMQ'ya özgü HER ŞEY bu dosyada kalır: bağlantı ayarları, Queue/Worker
 * nesneleri, yeniden deneme stratejisi, iş kimliği kuralları. Dışarısı sadece
 * QueuePort görür. RabbitMQ'ya geçilecekse yazılacak tek şey kardeş bir
 * `RabbitMqQueueAdapter` ve QueueModule'de tek satır değişiklik olur.
 */
@Injectable()
export class BullMqQueueAdapter implements QueuePort, OnModuleDestroy {
  private readonly logger = new Logger(BullMqQueueAdapter.name);
  private readonly connection: ConnectionOptions;
  /** Konu başına tek Queue/Worker: her enqueue'da yeni nesne yaratmak yeni
   *  Redis bağlantısı açardı. */
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();

  constructor(config: TypedConfigService) {
    this.connection = {
      host: config.get('REDIS_HOST'),
      port: config.get('REDIS_PORT'),
    };
  }

  private queueFor(topic: string): Queue {
    let queue = this.queues.get(topic);
    if (!queue) {
      queue = new Queue(topic, {
        connection: this.connection,
        defaultJobOptions: {
          // Başarılı işleri Redis'te tutmanın anlamı yok, bellek şişer.
          removeOnComplete: { count: 100 },
          // Başarısızları tutuyoruz: ne olduğunu incelemek için.
          removeOnFail: { count: 1000 },
        },
      });
      this.queues.set(topic, queue);
    }
    return queue;
  }

  async enqueue<T>(topic: string, payload: T, options?: EnqueueOptions): Promise<void> {
    await this.queueFor(topic).add(topic, payload, {
      delay: options?.delayMs,
      // Üstel geri çekilme: geçici bir arıza varsa (DB kısa süre yanıt
      // vermiyor) art arda saldırmak yerine aralığı açarak dene.
      attempts: options?.attempts ?? 3,
      backoff: { type: 'exponential', delay: 1_000 },
      // BullMQ aynı jobId'li ikinci işi sessizce yok sayar — idempotency'yi
      // taşıyıcı seviyesinde bedavaya almış oluyoruz.
      jobId: options?.idempotencyKey,
    });
  }

  async schedule<T>(topic: string, cron: string, payload: T): Promise<void> {
    // BullMQ'da tekrar eden iş: aynı anahtarla ikinci kez eklenmek yeni bir
    // zamanlama YARATMIYOR, mevcudu güncelliyor. Uygulama her yeniden
    // başladığında bu çağrılacağı için bu davranış şart — aksi hâlde her
    // deploy bir kopya daha ekler ve bildirim üç kez giderdi.
    // BullMQ 6'nın API'si: `upsertJobScheduler` adından da belli olduğu gibi
    // varsa günceller, yoksa yaratır. Eski sürümlerdeki `add(..., { repeat })`
    // her çağrıda yeni bir zamanlama ekleyebiliyordu.
    await this.queueFor(topic).upsertJobScheduler(
      `repeat:${topic}`,
      { pattern: cron },
      { name: topic, data: payload as object },
    );
    this.logger.log(`Zamanlanmış iş kuruldu: ${topic} (${cron})`);
  }

  async process<T>(topic: string, handler: JobHandler<T>): Promise<void> {
    if (this.workers.has(topic)) {
      throw new Error(`'${topic}' konusu için zaten bir işleyici kayıtlı`);
    }
    const worker = new Worker<T>(topic, async (job) => handler(job.data), {
      connection: this.connection,
    });
    worker.on('failed', (job, err) => {
      this.logger.error(`İş başarısız [${topic}#${job?.id}]: ${err.message}`);
    });
    this.workers.set(topic, worker);
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Konu fark etmez; amaç Redis'e gidip gelebildiğimizi doğrulamak.
      await this.queueFor('health').getJobCounts();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Kapanırken işlenmekte olan iş varsa bitmesini bekle, sonra bağlantıları
    // kapat — yarım kalan iş "kayıp iş" demek.
    await Promise.all([...this.workers.values()].map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}
