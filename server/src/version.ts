import { createRequire } from 'node:module';

/**
 * Çalışan sürüm — tek kaynak: `package.json`.
 *
 * Elle yazılan bir sabit ya da `process.env.npm_package_version` yerine burası
 * okunuyor. Ortam değişkeni yalnızca npm bir script çalıştırdığında dolu:
 * `node dist/main` ile doğrudan başlatılınca (üretimde olacağı gibi) boş
 * geliyor ve sürüm sessizce "0.0.0" oluyordu. Sessizce yanlış bir sürüm
 * numarası, hiç olmamasından kötü: "canlıda hangi sürüm var" sorusuna yanlış
 * cevap verir.
 *
 * `createRequire` gerekiyor çünkü bu paket ESM ve JSON import'u import
 * attribute istiyor. Yol her iki durumda da doğru çözülüyor:
 * `dist/version.js` ve `src/version.ts` — ikisi de `server/` altında bir
 * seviye derinde.
 */
const require = createRequire(import.meta.url);

export const APP_VERSION: string = (require('../package.json') as { version: string }).version;
