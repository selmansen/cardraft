/**
 * Tohumlanabilir (seeded) rastgelelik.
 *
 * NEDEN GEREKLİ:
 * Maç sonucunun sunucuda doğrulanabilmesi için, aynı tohum ve aynı hamlelerle
 * oynanan bir maçın HER ZAMAN aynı sonucu vermesi gerekiyor. `Math.random()`
 * bunu imkânsız kılıyordu: deste karışımı, botun rastgele hedef seçimi ve
 * "blunder" kararları her çalıştırmada farklı çıkıyor, dolayısıyla sunucu
 * istemcinin maçını yeniden oynatıp "gerçekten kazanmış mı" diye
 * kontrol edemiyordu.
 *
 * Tohumu sunucu üretiyor ve maç başlarken istemciye veriyor. İstemci onunla
 * oynuyor, sonra hamlelerini gönderiyor; sunucu aynı tohumla aynı motoru
 * çalıştırıp sonucu kendi hesaplıyor. Böylece "kazandım" iddiası bir veri
 * değil, sunucunun kendi hesabı oluyor.
 *
 * Algoritma mulberry32: 32-bit durumlu, hızlı, dağılımı oyun için fazlasıyla
 * iyi. Kriptografik DEĞİL ve olmasına gerek de yok — burada amaç gizlilik
 * değil tekrarlanabilirlik. (Tohumun tahmin edilemez olması gerekiyorsa o
 * ayrı bir mesele ve tohumu üreten sunucunun sorumluluğu.)
 */

/** Rastgelelik durumunu taşıyan her nesne (pratikte BattleState). */
export interface RngHolder {
  /** İlerledikçe değişen 32-bit durum. Maç state'inin parçası olduğu için
   *  klonlanıyor ve seri hâle getirilebiliyor. */
  rngState: number;
}

/** Metin bir tohumu (uuid gibi) 32-bit sayıya indirger. */
export function seedFromString(seed: string): number {
  // FNV-1a: kısa, çakışması bu amaç için önemsiz, dağılımı yeterli.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Sıradaki [0,1) değeri. Durumu YERİNDE ilerletir — motorun geri kalanı da
 * klonlanmış state'i mutasyonla işlediği için aynı üslupta.
 */
export function nextRandom(holder: RngHolder): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) | 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** [0, maxExclusive) aralığında tam sayı. */
export function nextInt(holder: RngHolder, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.floor(nextRandom(holder) * maxExclusive);
}

/** Diziden rastgele bir eleman (boşsa undefined). */
export function pickRandom<T>(holder: RngHolder, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[nextInt(holder, items.length)];
}

/** Fisher-Yates — yeni dizi döndürür, girdiyi bozmaz. */
export function shuffleWith<T>(holder: RngHolder, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = nextInt(holder, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
