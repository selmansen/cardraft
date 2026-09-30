import { CARDS } from '@/data/cards';
import type { CardPrice, Currency, Rarity } from '@/types';

/**
 * Paket tanımları — fiyatlar ve oranlar burada, tek kaynakta.
 *
 * Neden motorda (istemci ve sunucunun paylaştığı dosyada): oranları oyuncuya
 * mağaza ekranı gösteriyor, çekilişi ise sunucu yapıyor. İki yerde iki tablo
 * tutulsaydı, ekranda "%17 destansı" yazarken sunucunun %3 ile çekmesi
 * mümkün olurdu — ve bu fark kimsenin göremeyeceği bir yerde, oyuncunun
 * aleyhine sessizce durabilirdi. Mağaza politikaları da yayınlanan oranla
 * gerçek oranın aynı olmasını zorunlu tutuyor.
 *
 * Gerekçeler ADR 0010'da: havuz 35 kart olduğu için oranlar bilerek yüksek
 * (%3–17 destansı), paket tek kart veriyor ve hiçbir kart pakete özel değil.
 */

export type PackId = 'basic' | 'rare-plus';

export interface PackDefinition {
  id: PackId;
  name: string;
  /** Mağazada kartın altında duran bir cümlelik işlev tarifi. */
  blurb: string;
  price: CardPrice;
  /**
   * Nadirlik oranları. Toplamı 100 olmak zorunda — `assertPackOdds` bunu
   * yükleme anında doğruluyor, çünkü toplamı 99 olan bir tablo çekilişte
   * sessizce son nadirliğe kayar.
   */
  odds: Partial<Record<Rarity, number>>;
}

export const PACKS: PackDefinition[] = [
  {
    id: 'basic',
    name: 'Temel Paket',
    blurb: 'Tek kart · koleksiyonu hızlı büyütür',
    price: { rim: 350, coin: 55 },
    odds: { common: 60, rare: 26, epic: 11, legendary: 3 },
  },
  {
    id: 'rare-plus',
    name: 'Nadir+ Paketi',
    blurb: 'Sıradan kart çıkmaz · güçlü kart arayana',
    price: { rim: 800, coin: 125 },
    odds: { rare: 50, epic: 33, legendary: 17 },
  },
];

/**
 * Paketin coin fiyatları nereden geldi: iki kesede AYNI indirim oranı.
 *
 * Kart fiyatları zaten iki keseli ve coin tarafı jantın kabaca altıda biri
 * (300/50 · 600/100 · 1800/280 · 3600/550). Paket fiyatı ise kartın
 * beklenen değerinden daha düşük — paketi verimli ama rastgele yol yapan şey
 * bu. O indirim oranı iki kesede aynı tutuldu:
 *
 *   Temel     · beklenen 642 jant, fiyat 350  → 0,545
 *               beklenen 103 coin, fiyat 55   → 0,533
 *   Nadir+    · beklenen 1506 jant, fiyat 800 → 0,531
 *               beklenen 236 coin, fiyat 125  → 0,530
 *
 * Aynı olmak zorunda: bir kese diğerinden belirgin ucuz olsaydı oyuncunun
 * seçimi "hangisiyle ödemek istiyorum" değil "hangisi kârlı" olurdu ve para
 * ödeyen taraf ya kazıklanmış ya avantajlı olurdu. İkisi de istemediğimiz
 * şey — para ZAMAN satın alıyor, indirim değil.
 */

/** Paketin seçilen kesedeki fiyatı. 0 = o keseyle satılmıyor. */
export function packPrice(pack: PackDefinition, currency: Currency): number {
  return currency === 'coin' ? pack.price.coin : pack.price.rim;
}

/**
 * Sahip olunan kart çıktığında geri dönen oran.
 *
 * Tekrar kart bir kayıp değil ama kazanç da değil: %25, paketi "boşa gitti"
 * hissinden kurtaracak kadar yüksek, tekrar kart toplamayı bir strateji
 * haline getirmeyecek kadar düşük.
 */
export const DUPLICATE_REFUND_RATE = 0.25;

/**
 * Tekrar çıkan kartın iadesi — aşağı yuvarlanır, kesirli para yok.
 *
 * İade HANGİ KESEYLE ödendiyse o keseye dönüyor. Bu bir tercih değil,
 * zorunluluk: coin ile açılan paketin iadesi jant olarak verilseydi, parayla
 * alınan coin janta çevrilebilir hâle gelirdi. Oyuncu tekrar kart çıkması
 * kesin olan bir paketi (koleksiyonu tamamlanmış nadirlik) döngüye alıp
 * coin'i janta yıkardı — yani gerçek parayla oyun içi kazanç satın alınırdı.
 */
export function duplicateRefund(cardPrice: CardPrice, currency: Currency): number {
  const price = currency === 'coin' ? cardPrice.coin : cardPrice.rim;
  return Math.floor(price * DUPLICATE_REFUND_RATE);
}

/**
 * Nadirlik çekilişi — rastgeleliği DIŞARIDAN alıyor.
 *
 * Böyle yazılması test içindi ama daha doğru da: çekiliş kuralı (kümülatif
 * aralık) oranların yanında, rastgeleliğin kalitesi ise sunucunun sorunu
 * (orada kriptografik üreteç kullanılıyor — para söz konusu olduğu için
 * öngörülebilir bir üreteç, sırayı bilen birine destansı kartın ne zaman
 * geleceğini hesaplatırdı).
 *
 * @param roll 0–99 arası tam sayı.
 */
export function rarityForRoll(odds: Partial<Record<Rarity, number>>, roll: number): Rarity {
  let cumulative = 0;
  for (const [rarity, chance] of Object.entries(odds) as [Rarity, number][]) {
    cumulative += chance;
    if (roll < cumulative) return rarity;
  }
  // Oranlar 100 etmiyorsa buraya düşülür; `assertPackOdds` bunu açılışta
  // engelliyor, yani burası yalnızca son çare.
  return Object.keys(odds)[0] as Rarity;
}

export function getPack(id: string): PackDefinition | undefined {
  return PACKS.find((p) => p.id === id);
}

/**
 * Paketin bir kesede satılıp satılmadığı. Fiyatı 0 olan kese kapalı.
 */
export function packSoldFor(pack: PackDefinition, currency: Currency): boolean {
  return packPrice(pack, currency) > 0;
}

/**
 * Paketlerden çıkabilecek kartlar: ARAÇ kartları, başlangıç kartları hariç.
 *
 * Pit Ekibi paketlerde yok çünkü onların fiyatı nadirliğe değil güç
 * seviyesine bağlı — nadirlik tablosuyla çekilemezler. Ayrıca 11 tane ve
 * bilerek kıt tutuluyorlar (ADR 0009); rastgele dağıtmak o kıtlığı bozardı.
 *
 * Başlangıç kartları da havuz dışında: fiyatları 0 olduğu için çıktıklarında
 * iadeleri de 0 olurdu, yani oyuncunun eline hiçbir şey geçmeyen bir sonuç.
 */
export function packPool(rarity: Rarity): string[] {
  return CARDS.filter((c) => c.rarity === rarity && c.price.rim > 0).map((c) => c.id);
}

/** Oran tablosu bozuksa uygulama açılışta patlasın, çekilişte değil. */
export function assertPackOdds(): void {
  for (const pack of PACKS) {
    if (pack.price.rim <= 0 && pack.price.coin <= 0) {
      throw new Error(`${pack.id} paketinin hiçbir kesede fiyatı yok`);
    }
    const total = Object.values(pack.odds).reduce((sum, n) => sum + n, 0);
    if (total !== 100) {
      throw new Error(`${pack.id} paketinin oranları 100 etmiyor: ${total}`);
    }
    for (const rarity of Object.keys(pack.odds) as Rarity[]) {
      if (packPool(rarity).length === 0) {
        throw new Error(`${pack.id} paketi "${rarity}" çekebiliyor ama o nadirlikte kart yok`);
      }
    }
  }
}

assertPackOdds();
