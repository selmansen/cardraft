import { makeBotLoadout, makeBotSupportLoadout } from '../../game-engine/game/botDeck.js';
import {
  BOT_SUPPORT_COUNT,
  BOT_VEHICLE_COUNT,
  LOADOUT_TOTAL,
  MAX_SUPPORT,
  MIN_VEHICLES,
  validateLoadout,
} from '../../game-engine/game/loadoutRules.js';
import { CARDS } from '../../game-engine/data/cards.js';
import { SUPPORT_CARDS } from '../../game-engine/data/supportCards.js';

const RARITY_ORDER: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const rarityOf = new Map(CARDS.map((c) => [c.id, RARITY_ORDER[c.rarity]]));
const powerOf = new Map(SUPPORT_CARDS.map((c) => [c.id, c.power]));

/** Rastgelelik içeren üreticiler: tek çağrı bir şey kanıtlamaz. */
const SAMPLES = 200;

describe('validateLoadout', () => {
  const vehicles = (n: number) => CARDS.slice(0, n).map((c) => c.id);
  const support = (n: number) => SUPPORT_CARDS.slice(0, n).map((c) => c.id);

  it('5 araç + 3 pit geçerli', () => {
    expect(validateLoadout(vehicles(5), support(3))).toBeNull();
  });

  it('toplam 8 değilse reddediyor', () => {
    // Sunucunun eskiden kaçırdığı durum: her dizi tek başına sınırın altında
    // ama toplam fazla. Deste kadronun iki katı olduğu için fazladan her kart,
    // yorgunluk yarışında bedava avantaj demekti.
    expect(validateLoadout(vehicles(6), support(3))).toMatch(/tam 8 kart/);
    expect(validateLoadout(vehicles(4), support(3))).toMatch(/tam 8 kart/);
    expect(validateLoadout(vehicles(8), support(8))).toMatch(/tam 8 kart/);
  });

  it('en az 3 araç şartını uyguluyor', () => {
    // Araçsız deste hiç saldıramaz; maç yorgunlukla biter.
    expect(validateLoadout(vehicles(2), support(6))).toMatch(new RegExp(`en az ${MIN_VEHICLES} araç`));
  });

  it('en fazla 5 pit şartını uyguluyor', () => {
    // 3 araç + 5 pit tam sınırda: geçmeli.
    expect(validateLoadout(vehicles(3), support(5))).toBeNull();
    expect(MAX_SUPPORT).toBe(5);
  });

  it('aynı kartın iki kez yazılmasını reddediyor', () => {
    // Aynı kimliği iki kez göndermek, desteye dört kopya koymak demekti.
    const dup = [...vehicles(4), CARDS[0].id];
    expect(validateLoadout(dup, support(3))).toMatch(/birden fazla/);
  });
});

describe('makeBotLoadout — boyut', () => {
  it('her ilerleme kademesinde tam olarak oyuncu kadar kart veriyor', () => {
    // Botun kadrosu oyuncununkinden büyük olursa uzun maçları kimsenin
    // vermediği bir kararla kazanır (deste = kadro × 2, sonrasında yorgunluk).
    for (const wins of [0, 3, 10, 25, 100]) {
      for (let i = 0; i < SAMPLES; i++) {
        const loadout = makeBotLoadout(wins);
        expect(loadout.length, `galibiyet ${wins}`).toBe(BOT_VEHICLE_COUNT);
        const support = makeBotSupportLoadout(undefined, wins);
        expect(support.length, `galibiyet ${wins} destek`).toBe(BOT_SUPPORT_COUNT);
        // Botun toplamı oyuncunun bütçesiyle aynı olmalı.
        expect(loadout.length + support.length).toBe(LOADOUT_TOTAL);
      }
    }
  });

  it('aynı kartı iki kez koymuyor', () => {
    for (let i = 0; i < SAMPLES; i++) {
      const ids = makeBotLoadout(30).map((e) => e.cardId);
      expect(new Set(ids).size).toBe(ids.length);
      const support = makeBotSupportLoadout(undefined, 30);
      expect(new Set(support).size).toBe(support.length);
    }
  });
});

describe('makeBotLoadout — ilerlemeye göre ölçekleme', () => {
  /** Bir kademede botun görebildiği en yüksek nadirlik. */
  function maxRarity(wins: number): number {
    let max = 0;
    for (let i = 0; i < SAMPLES; i++) {
      for (const { cardId } of makeBotLoadout(wins)) {
        max = Math.max(max, rarityOf.get(cardId) ?? 0);
      }
    }
    return max;
  }

  it('yeni oyuncu yalnızca sıradan kartlarla karşılaşıyor', () => {
    // Bu test ölçeklemenin AÇIK olduğunun kanıtı. Bir dönem `makeBotLoadout()`
    // parametresiz çağrılıyordu ve ölçekleme sessizce devre dışı kalmıştı;
    // kimse fark etmemişti çünkü her şey "çalışıyordu".
    expect(maxRarity(0)).toBe(0);
  });

  it('ilerledikçe üst nadirlikler açılıyor', () => {
    expect(maxRarity(3)).toBe(1);
    expect(maxRarity(10)).toBe(2);
    expect(maxRarity(25)).toBe(3);
  });

  it('nadirlik merdiveni geriye gitmiyor', () => {
    const tiers = [0, 3, 10, 25].map(maxRarity);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
  });

  it('Pit Ekibi güç seviyesi aynı merdiveni izliyor', () => {
    // Araç nadirliği ile pit gücü ayrı ayrı ayarlansaydı, birini değiştirip
    // diğerini unutmak mümkün olurdu.
    const maxPower = (wins: number) => {
      let max = 0;
      for (let i = 0; i < SAMPLES; i++) {
        for (const id of makeBotSupportLoadout(undefined, wins)) {
          max = Math.max(max, powerOf.get(id) ?? 0);
        }
      }
      return max;
    };

    expect(maxPower(0)).toBe(1);
    expect(maxPower(25)).toBeGreaterThan(maxPower(0));
  });
});
