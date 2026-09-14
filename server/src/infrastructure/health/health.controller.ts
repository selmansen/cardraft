import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/auth.decorators.js';
import { APP_VERSION } from '../../version.js';
import { CacheService } from '../cache/cache.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QUEUE_PORT, type QueuePort } from '../queue/queue.port.js';

/**
 * Sağlık kontrolü — üç altyapı bağımlılığının da gerçekten ayakta olduğunu
 * söyler.
 *
 * Neden "200 OK" dönen boş bir uç nokta yetmiyor: uygulama ayakta ama
 * veritabanı düşmüşse yine 200 döner ve izleme sistemi her şeyin yolunda
 * sandığı için kimse haberdar olmaz. Sağlık kontrolü, bağımlılıklara
 * gerçekten dokunmadığı sürece yanlış güven verir.
 *
 * Dikkat: kuyruk `QueuePort` üzerinden soruluyor — bu controller BullMQ
 * diye bir şeyin varlığından habersiz. Adapter deseninin somut karşılığı bu.
 */
@ApiTags('Sistem')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
  ) {}

  /**
   * Sunucunun ve bağımlılıklarının durumu, çalışan sürüm, ayakta kalma süresi.
   *
   * Bilerek `@Public`: bunu çağıran şey bir oyuncu değil — CI, Docker sağlık
   * kontrolü ve ileride AWS yük dengeleyici. Token isteyen bir sağlık
   * kontrolü, dengeleyicinin sağlıklı sunucuyu ölü sanmasına yol açar.
   *
   * Sızdırdığı tek ek bilgi sürüm ve ayakta kalma süresi; saldırgana işe
   * yarar bir şey vermiyor, operasyona ise "canlıda hangi sürüm var" ve
   * "sessizce yeniden mi başladı" sorularının cevabını veriyor.
   */
  @Public()
  @Get()
  async check() {
    const [database, redis, queue] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`.then(() => true)
        .catch(() => false),
      this.cache.raw
        .ping()
        .then((r) => r === 'PONG')
        .catch(() => false),
      this.queue.isHealthy(),
    ]);

    return {
      status: database && redis && queue ? 'ok' : 'degraded',
      version: APP_VERSION,
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: { database, redis, queue },
    };
  }
}
