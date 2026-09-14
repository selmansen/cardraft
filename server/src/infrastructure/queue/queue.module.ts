import { Global, Module } from '@nestjs/common';

import { BullMqQueueAdapter } from './bullmq/bullmq-queue.adapter.js';
import { QUEUE_PORT } from './queue.port.js';

/**
 * Taşıyıcı seçiminin yapıldığı TEK yer.
 *
 * RabbitMQ'ya geçiş şuna indirgeniyor:
 *   1. `RabbitMqQueueAdapter` yaz (QueuePort'u uygular),
 *   2. aşağıdaki `useClass` değerini değiştir.
 * İş mantığında tek satır değişmez — soyutlamanın somut getirisi bu.
 *
 * Ortama göre farklı adapter de mümkün (örn. testte bellek içi bir adapter):
 * `useClass` yerine `useFactory` ile NODE_ENV'e bakılır. Şimdilik gerek yok,
 * gerektiğinde değişecek yer yine sadece burası.
 */
@Global()
@Module({
  providers: [{ provide: QUEUE_PORT, useClass: BullMqQueueAdapter }],
  exports: [QUEUE_PORT],
})
export class QueueModule {}
