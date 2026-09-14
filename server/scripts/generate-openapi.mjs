#!/usr/bin/env node
/**
 * OpenAPI şemasını dosyaya yazar: docs/api/openapi.json
 *
 * Neden derlenmiş `dist/` üzerinden çalışıyor:
 *   NestJS'in bağımlılık enjeksiyonu `emitDecoratorMetadata` çıktısına
 *   dayanıyor ve `tsx` (esbuild) bu metadata'yı üretmiyor — TypeScript
 *   kaynağını doğrudan çalıştıran bir script "Nest can't resolve
 *   dependencies" ile patlar, kod doğru olsa bile. Ayrıca şemayı üreten
 *   Swagger eklentisi zaten derleme sırasında çalışıyor; dist okumak
 *   belgenin gerçekten derlenen kodla aynı olmasını da garanti ediyor.
 *   `prebuild` bağlı olduğu için `npm run openapi` derlemeyi kendi yapar.
 *
 * Neden "preview" kipi:
 *   Şema üretmek için uygulamanın AYAKTA olması gerekmiyor, sadece
 *   yapısının bilinmesi gerekiyor. Preview kipinde Nest provider'ları hiç
 *   örneklemiyor — yani Postgres ve Redis olmadan da çalışıyor. Bu, CI'da
 *   ve yeni klonlamış birinin makinesinde fark yaratıyor.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../dist/app.module.js';
import { buildOpenApiDocument } from '../dist/swagger.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'api', 'openapi.json');

const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
// main.ts'teki ile aynı önek: şemadaki yollar gerçek yollarla birebir olsun.
app.setGlobalPrefix('api');
await app.init();

const document = buildOpenApiDocument(app);
writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`);
await app.close();

const paths = Object.keys(document.paths);
const operations = paths.reduce(
  (n, p) => n + Object.keys(document.paths[p]).filter((m) => m !== 'parameters').length,
  0,
);
console.log(`docs/api/openapi.json yazıldı — ${paths.length} yol, ${operations} uç nokta.`);
