import {
  DUPLICATE_REFUND_RATE,
  duplicateRefund,
  getPack,
  PACKS,
  packPool,
  rarityForRoll,
} from '../../game-engine/game/packs.js';
import { CARDS, STARTER_CARD_IDS } from '../../game-engine/data/cards.js';
import { SUPPORT_CARDS } from '../../game-engine/data/supportCards.js';
import type { Rarity } from '../../game-engine/types/index.js';

/**
 * Paket kuralları.
 *
 * Bu sayılar oyuncuya YAYINLANIYOR — mağaza ekranı oranları gösteriyor ve
 * mağaza politikaları gösterilenle gerçeğin aynı olmasını zorunlu tutuyor.
 * Dolayısıyla buradaki testler bir denge tercihini değil, bir sözü koruyor.
 */
describe('paket tanımları', () => {
  it('her paketin oranları tam 100 ediyor', () => {
    // 99 eden bir tablo çekilişte sessizce son nadirliğe kayar: oyuncuya
    // %3 denip %4 verilmesi (ya da tersi) kimsenin fark etmeyeceği bir hata.
    for (const pack of PACKS) {
      const total = Object.values(pack.odds).reduce((sum, n) => sum + n, 0);
      expect(total, pack.id).toBe(100);
    }
  });

  it('Nadir+ paketinden sıradan kart çıkmıyor', () => {
    // Paketin tek varlık sebebi bu; oranlara "common" eklenirse iki paket
    // aynı işi yapar ve 800 jant fiyatın karşılığı kalmaz.
    expect(getPack('rare-plus')!.odds.common).toBeUndefined();
  });

  it('fiyatlar ADR 0010 ile aynı', () => {
    expect(getPack('basic')!.price.rim).toBe(350);
    expect(getPack('rare-plus')!.price.rim).toBe(800);
  });
});

describe('packPool', () => {
  it('her çekilebilir nadirlikte en az bir kart var', () => {
    // Boş havuz çekilişte patlar; sorunun paket açan oyuncuda değil burada
    // görülmesi gerekiyor.
    for (const pack of PACKS) {
      for (const rarity of Object.keys(pack.odds) as Rarity[]) {
        expect(packPool(rarity).length, `${pack.id}/${rarity}`).toBeGreaterThan(0);
      }
    }
  });

  it('başlangıç kartları havuzda yok', () => {
    // Fiyatları 0 olduğu için iadeleri de 0 olurdu: oyuncunun eline hiçbir
    // şey geçmeyen bir açılış.
    const pool = new Set((['common', 'rare', 'epic', 'legendary'] as Rarity[]).flatMap(packPool));
    for (const id of STARTER_CARD_IDS) {
      expect(pool.has(id), `başlangıç kartı ${id}`).toBe(false);
    }
  });

  it('Pit Ekibi kartları havuzda yok', () => {
    // Destek kartlarının fiyatı nadirliğe değil güç seviyesine bağlı, yani
    // nadirlik tablosuyla çekilemezler. Ayrıca bilerek kıt tutuluyorlar.
    const pool = new Set((['common', 'rare', 'epic', 'legendary'] as Rarity[]).flatMap(packPool));
    for (const support of SUPPORT_CARDS) {
      expect(pool.has(support.id), `pit kartı ${support.id}`).toBe(false);
    }
  });

  it('havuzdaki her kart gerçekten o nadirlikte', () => {
    const rarityOf = new Map(CARDS.map((c) => [c.id, c.rarity]));
    for (const rarity of ['common', 'rare', 'epic', 'legendary'] as Rarity[]) {
      for (const id of packPool(rarity)) {
        expect(rarityOf.get(id), id).toBe(rarity);
      }
    }
  });
});

describe('rarityForRoll', () => {
  const basic = getPack('basic')!.odds;

  it('aralıkların sınırları doğru yerde', () => {
    // 60/26/11/3 → [0,60) sıradan, [60,86) nadir, [86,97) efsanevi, [97,100) destansı.
    expect(rarityForRoll(basic, 0)).toBe('common');
    expect(rarityForRoll(basic, 59)).toBe('common');
    expect(rarityForRoll(basic, 60)).toBe('rare');
    expect(rarityForRoll(basic, 85)).toBe('rare');
    expect(rarityForRoll(basic, 86)).toBe('epic');
    expect(rarityForRoll(basic, 96)).toBe('epic');
    expect(rarityForRoll(basic, 97)).toBe('legendary');
    expect(rarityForRoll(basic, 99)).toBe('legendary');
  });

  it('0–99 taraması ilan edilen oranların birebir aynısını veriyor', () => {
    // Yayınlanan oran ile gerçek oran arasındaki farkı yakalayan test bu.
    for (const pack of PACKS) {
      const counts: Record<string, number> = {};
      for (let roll = 0; roll < 100; roll++) {
        const rarity = rarityForRoll(pack.odds, roll);
        counts[rarity] = (counts[rarity] ?? 0) + 1;
      }
      expect(counts, pack.id).toEqual(pack.odds);
    }
  });
});

describe('duplicateRefund', () => {
  it('kart değerinin dörtte biri, aşağı yuvarlanmış', () => {
    expect(DUPLICATE_REFUND_RATE).toBe(0.25);
    expect(duplicateRefund(600)).toBe(150);
    expect(duplicateRefund(1800)).toBe(450);
    expect(duplicateRefund(3600)).toBe(900);
    // Kesirli jant yok: 350/4 = 87,5 → 87.
    expect(duplicateRefund(350)).toBe(87);
  });

  it('paket açmak uzun vadede jant kazandırmıyor', () => {
    /**
     * Korunan şey TEK açılış değil, BEKLENEN DEĞER.
     *
     * Tek açılışta kâr mümkün ve olmalı da: 350 jantlık Temel paketten
     * tekrar destansı kart çıkarsa 900 jant geri döner. Bu bir sızıntı değil,
     * koleksiyonu tamamlamış oyuncuya kalan tek heyecan — ve olasılığı %3.
     *
     * Sızıntı, her nadirliğin olasılığıyla çarpılmış iadenin paketin
     * fiyatını geçmesi olurdu: o zaman "koleksiyonu tamamla, sonsuz paket aç"
     * bir jant üretme makinesine dönerdi. Bu test o kapıyı kapalı tutuyor —
     * biri oranları ya da iade yüzdesini değiştirdiğinde burada patlar.
     */
    const priceOf = new Map(CARDS.map((c) => [c.id, c.price.rim]));

    for (const pack of PACKS) {
      let expected = 0;
      for (const [rarity, chance] of Object.entries(pack.odds) as [Rarity, number][]) {
        const pool = packPool(rarity);
        // O nadirlikteki ortalama kart değeri (havuzdan eşit olasılıkla çekiliyor).
        const avgRefund =
          pool.reduce((sum, id) => sum + duplicateRefund(priceOf.get(id)!), 0) / pool.length;
        expected += (chance / 100) * avgRefund;
      }
      expect(expected, `${pack.id} beklenen iade`).toBeLessThan(pack.price.rim);
    }
  });
});
