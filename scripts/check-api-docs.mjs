#!/usr/bin/env node
/**
 * Postman koleksiyonunun OpenAPI şemasını tam kapsadığını doğrular.
 *
 * Neden bu kontrol var:
 *   OpenAPI şeması koddan üretiliyor, yani her zaman doğru. Postman
 *   koleksiyonu ise elle yazıldı — çünkü değerli olan kısmı (sıralı akış,
 *   token yakalama, gerçek örnek gövdeler) üretilemez. Elle yazılan her
 *   belge gibi onun da riski kodun gerisinde kalması ve gerisinde kaldığı
 *   gün, okuyan kişiyi yanlış yönlendirdiği için hiç olmamasından kötü
 *   olması. Bu script o riski kapatıyor: yeni bir uç nokta eklenip
 *   koleksiyona yazılmazsa CI kırılır.
 *
 * Ters yönü de kontrol ediliyor (koleksiyonda olup şemada olmayan istek):
 *   silinmiş bir uç noktanın koleksiyonda unutulması, olmayan bir API'yi
 *   belgelemek demek.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'api');

const openapi = JSON.parse(readFileSync(join(API_DIR, 'openapi.json'), 'utf8'));
const collection = JSON.parse(readFileSync(join(API_DIR, 'CarDraft.postman_collection.json'), 'utf8'));

/**
 * İki tarafın yol yazımı farklı: OpenAPI `/api/matches/{id}/submit` derken
 * Postman `{{baseUrl}}/matches/{{matchId}}/submit` diyor. Karşılaştırabilmek
 * için ikisi de aynı biçime indirgeniyor: değişken segmentler `:param`.
 */
function normalize(path) {
  return path
    .replace(/^\/api/, '')
    .replace(/\{\{baseUrl\}\}/, '')
    .split('?')[0]
    .split('/')
    .map((segment) => (/^(\{\{.+\}\}|\{.+\})$/.test(segment) ? ':param' : segment))
    .join('/');
}

const inSchema = new Set();
for (const [path, methods] of Object.entries(openapi.paths)) {
  for (const method of Object.keys(methods)) {
    inSchema.add(`${method.toUpperCase()} ${normalize(path)}`);
  }
}

const inCollection = new Set();
for (const folder of collection.item) {
  for (const item of folder.item) {
    inCollection.add(`${item.request.method} ${normalize(item.request.url.raw)}`);
  }
}

const missing = [...inSchema].filter((op) => !inCollection.has(op)).sort();
const extra = [...inCollection].filter((op) => !inSchema.has(op)).sort();

if (missing.length === 0 && extra.length === 0) {
  console.log(`API belgesi tutarlı — ${inSchema.size} uç nokta, hepsi koleksiyonda.`);
  process.exit(0);
}

if (missing.length > 0) {
  console.error('\nOpenAPI şemasında var, Postman koleksiyonunda YOK:');
  for (const op of missing) console.error(`  - ${op}`);
  console.error('\n  Yeni uç noktayı docs/api/CarDraft.postman_collection.json içine ekle.');
}
if (extra.length > 0) {
  console.error('\nPostman koleksiyonunda var, OpenAPI şemasında YOK:');
  for (const op of extra) console.error(`  - ${op}`);
  console.error('\n  Uç nokta silindiyse koleksiyondan da çıkar; duruyorsa şemayı yenile:');
  console.error('    cd server && npm run openapi');
}
console.error('');
process.exit(1);
