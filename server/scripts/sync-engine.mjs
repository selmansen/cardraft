/**
 * Oyun motorunu istemciden sunucuya senkronlar.
 *
 * NEDEN KOPYALIYORUZ:
 * Maçın sunucuda doğrulanabilmesi için iki tarafın BİREBİR aynı motoru
 * çalıştırması şart — tek satırlık bir fark, sunucunun meşru bir maçı
 * "hileli" sayması demek. Dolayısıyla motorun tek bir doğruluk kaynağı olmalı:
 * `src/game` (istemci tarafı). Buradaki kopya bir kaynak dosya değil, Prisma
 * istemcisi gibi ÜRETİLEN bir çıktı — gitignore'lu ve her `start`/`build`
 * öncesi yeniden üretiliyor, yani elle düzenlenirse ilk çalıştırmada geri
 * alınır.
 *
 * NEDEN npm workspace DEĞİL:
 * Doğrusu motoru paylaşılan bir pakete çıkarmak olurdu. Onu şimdilik
 * yapmadık çünkü Expo/Metro tarafında monorepo yapılandırması gerektiriyor ve
 * o an çalışır durumda olan istemciyi kırma riski taşıyordu. Bu script aynı
 * garantiyi (tek kaynak) sıfır istemci riskiyle veriyor; workspace'e geçiş
 * ileride, istemciye dokunmanın güvenli olduğu bir anda yapılabilir.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(here, '../../src');
const target = resolve(here, '../src/game-engine');

/** Kopyalanacak dosyalar: motor + bağımlı olduğu saf veri/tip dosyaları. */
const FILES = [
  ['types/index.ts', 'types/index.ts'],
  ['data/cards.ts', 'data/cards.ts'],
  ['data/supportCards.ts', 'data/supportCards.ts'],
  ['game/rng.ts', 'game/rng.ts'],
  ['game/battleEngine.ts', 'game/battleEngine.ts'],
  ['game/bot.ts', 'game/bot.ts'],
  // Zorluk ayarları ve bot desteleri de buradan geliyor: bunlar bir süre
  // sunucuda elle yazılmış kopya olarak durdu ve ilk denemede uydurma bir
  // kart kimliği ("roadblock" ≠ "road-block") yüzünden maç kurulumu patladı.
  // Kopya tutmak yerine tek kaynaktan almak, o sınıf hatayı tümden kaldırıyor.
  ['game/difficulty.ts', 'game/difficulty.ts'],
  ['game/botDeck.ts', 'game/botDeck.ts'],
  // Paket fiyatları ve oranları: mağaza ekranı gösteriyor, sunucu çekiyor.
  // İki kopya olsaydı gösterilen oranla gerçek oran ayrışabilirdi.
  ['game/packs.ts', 'game/packs.ts'],
];

/**
 * İstemci `@/...` yol takma adlarını kullanıyor ve uzantısız import yazıyor
 * (Metro böyle çözüyor). Sunucu ise ESM/nodenext: göreli yol ve `.js` uzantısı
 * şart. Dönüşüm burada yapılıyor ki motor dosyalarının kendisi değişmesin.
 */
function rewriteImports(source, fileKey) {
  const depth = fileKey.includes('/') ? '../' : './';
  return source
    .replace(/from '@\/types'/g, `from '${depth}types/index.js'`)
    .replace(/from '@\/data\/([\w-]+)'/g, `from '${depth}data/$1.js'`)
    .replace(/from '@\/game\/([\w-]+)'/g, `from '${depth}game/$1.js'`)
    // Aynı klasördeki göreli importlara uzantı ekle ('./rng' -> './rng.js').
    .replace(/from '\.\/([\w-]+)'/g, "from './$1.js'");
}

const header = `// ÜRETİLEN DOSYA — elle düzenlemeyin.
// Kaynak: src/<yol> (istemci). Yeniden üretmek için: npm run sync:engine
// Gerekçe için scripts/sync-engine.mjs başlığına bakın.
`;

await rm(target, { recursive: true, force: true });
for (const [from, to] of FILES) {
  const source = await readFile(join(clientRoot, from), 'utf8');
  const outPath = join(target, to);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, header + rewriteImports(source, to));
}

// Kalan takma ad varsa sessizce yanlış derlenmesin, hemen görülsün.
const leftovers = [];
for (const [, to] of FILES) {
  const content = await readFile(join(target, to), 'utf8');
  if (content.includes("from '@/")) leftovers.push(to);
}
if (leftovers.length > 0) {
  console.error('Çözülemeyen @/ importları:', leftovers.join(', '));
  process.exit(1);
}

const written = (await readdir(join(target, 'game'))).length;
console.log(`Motor senkronlandı: ${FILES.length} dosya (game/ altında ${written})`);
