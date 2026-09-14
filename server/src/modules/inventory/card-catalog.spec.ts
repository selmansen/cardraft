import { cardCatalog } from './card-catalog.js';
import { CARDS } from '../../game-engine/data/cards.js';
import { battleReward, SIGNUP_BONUS_RIM } from '../economy/reward.rules.js';
import { CardKind, CurrencyCode, LedgerReason } from '../../generated/prisma/enums.js';

/**
 * Katalog ve ödül kuralları — sunucudaki saf mantığın tamamı burada sınanıyor.
 *
 * Neden bu ikisi: ekonominin sunucu otoriteli olmasının pratik karşılığı
 * "fiyatı ve ödülü sunucu bilir" cümlesi. O cümle bu iki modülde yaşıyor.
 * Veritabanı gerekmiyor, dolayısıyla e2e'den ayrı, hızlı koşan birim testi
 * olarak burada duruyorlar.
 */
describe('cardCatalog', () => {
  it('başlangıç kartları her iki havuzdan da geliyor', () => {
    const starters = cardCatalog.starters();
    const vehicles = starters.filter((c) => c.kind === CardKind.VEHICLE);
    const support = starters.filter((c) => c.kind === CardKind.SUPPORT);

    // Kesin sayı yazılmadı: başlangıç kadrosu bir denge kararı ve değişecek.
    // Korunan kural, yeni oyuncunun iki havuzdan da kart almasıdır — sadece
    // araç verilse kadro kurulamaz (en fazla 5'i pit olabiliyor ama en az
    // 3'ü araç olmak zorunda).
    expect(vehicles.length).toBeGreaterThan(0);
    expect(support.length).toBeGreaterThan(0);
  });

  it('başlangıç kartlarının fiyatı sıfır', () => {
    // "Bedava" olmanın tek kaynağı fiyat tablosu; ayrı bir "starter" bayrağı
    // tutulsaydı ikisi ayrışabilir ve oyuncu sahip olduğu karta para ödemiş
    // görünebilirdi.
    for (const starter of cardCatalog.starters()) {
      const entry = cardCatalog.find(starter.cardId);
      expect(entry, starter.cardId).toBeDefined();
      expect(entry!.price.rim, `${starter.cardId} jant`).toBe(0);
      expect(entry!.price.coin, `${starter.cardId} coin`).toBe(0);
    }
  });

  it('kilitli kartların her iki para biriminde de fiyatı var', () => {
    const starters = new Set(cardCatalog.starters().map((c) => c.cardId));
    const locked = ['nocturne-coupe', 'apex-meridian', 'turbo-charge'];

    for (const cardId of locked) {
      const entry = cardCatalog.find(cardId);
      expect(entry, cardId).toBeDefined();
      expect(starters.has(cardId), `${cardId} başlangıç kartı olmamalı`).toBe(false);
      // Çift fiyat şart: kart yalnızca coin ile alınabilseydi, para
      // koleksiyona erişimi kapatırdı — modelin izin vermediği şey bu.
      expect(entry!.price.rim, `${cardId} jant`).toBeGreaterThan(0);
      expect(entry!.price.coin, `${cardId} coin`).toBeGreaterThan(0);
    }
  });

  it('olmayan kart undefined döner (çağıran 404 verebilsin)', () => {
    expect(cardCatalog.find('boyle-bir-kart-yok')).toBeUndefined();
  });
});

describe('battleReward', () => {
  it('ödül her zaman jant — kazanınca da kaybedince de', () => {
    // Coin oynayarak ASLA kazanılmıyor. Bu test o kuralın bekçisi: birisi
    // ödülü coin'e çevirirse premium para biriminin anlamı kalmaz.
    for (const won of [true, false]) {
      const reward = battleReward(won, 'normal');
      expect(reward.currency).toBe(CurrencyCode.RIM);
      expect(reward.reason).toBe(LedgerReason.BATTLE_REWARD);
    }
  });

  it('kaybedince de ödül var, ama kazanınca daha çok', () => {
    // Sıfır ödül, kaybeden oyuncuyu oyunu kapatmaya iter; eşit ödül ise
    // kazanmayı anlamsız kılar.
    const win = battleReward(true, 'normal').amount;
    const loss = battleReward(false, 'normal').amount;

    expect(loss).toBeGreaterThan(0);
    expect(win).toBeGreaterThan(loss);
  });

  it('zorluk arttıkça ödül artıyor', () => {
    // Ödül zorluğa bağlı olmasaydı herkes kolayda farmlardı ve zorluk
    // seçimi süs olurdu.
    const easy = battleReward(true, 'easy').amount;
    const normal = battleReward(true, 'normal').amount;
    const hard = battleReward(true, 'hard').amount;

    expect(easy).toBeLessThan(normal);
    expect(normal).toBeLessThan(hard);
  });

  it('başlangıç janttı en ucuz kilitli araca tam yetiyor', () => {
    // İlerlemenin tempo başlangıcı: oyuncu ilk kartını hemen açabilmeli ama
    // koleksiyonun geri kalanı hedef olarak durmalı. Bu iki sayı birbirine
    // bağlı — biri değişip diğeri unutulursa yeni oyuncu ya hiçbir şey
    // açamaz ya da baştan yarım koleksiyona sahip olur.
    const cheapestLocked = Math.min(
      ...CARDS.map((card) => cardCatalog.find(card.id)!.price.rim).filter((rim) => rim > 0),
    );

    expect(cheapestLocked).toBe(SIGNUP_BONUS_RIM);
  });
});
