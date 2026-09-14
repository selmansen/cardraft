import { createRequire } from 'node:module';

import { Injectable } from '@nestjs/common';

/**
 * Sürüm numarası `package.json`'dan okunuyor, elle yazılmıyor.
 *
 * İki yerde duran bir sürüm numarası er geç ayrışır ve ayrıştığında yanlış
 * olan taraf hep bu olur: yayın script'i package.json'ı yükseltir, buradaki
 * sabit eski kalır, /health "0.1.0" derken sunucuda 0.3.0 çalışıyordur.
 * Tek kaynak, tek doğru.
 *
 * `createRequire` gerekiyor çünkü bu paket ESM ("type": "module") ve JSON
 * import'u hâlâ import attribute istiyor. Yol her iki durumda da doğru
 * çözülüyor: dist/app.service.js → server/package.json, src/app.service.ts →
 * server/package.json (ikisi de server/ altında bir seviye derinde).
 */
const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export interface HealthStatus {
  status: 'ok';
  /** Çalışan sürüm — "canlıda hangi sürüm var" sorusunun cevabı. */
  version: string;
  /** Süreç kaç saniyedir ayakta. Sessiz yeniden başlatmaları görünür kılar. */
  uptimeSeconds: number;
}

@Injectable()
export class AppService {
  health(): HealthStatus {
    return {
      status: 'ok',
      version,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
