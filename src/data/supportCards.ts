import type { CardPrice, SupportCard, SupportPower } from '@/types';

/**
 * Pit Ekibi fiyatları — araç kartlarından BİLEREK daha sert.
 *
 * Gerekçe arz: 35 araç kartı var ve zamanla artacak; Pit Ekibi 11 tane ve
 * neredeyse sabit kalacak (yeni destek kartı tasarlamak, yeni araç eklemekten
 * çok daha zor — her biri kuralları değiştiriyor). Kıt olan kaynak daha
 * değerli olmalı, yoksa oyuncu tüm destek havuzunu birkaç günde tamamlayıp
 * ilerlemenin bu kolunu bitiriyor.
 *
 * Nadirlik yerine GÜÇ SEVİYESİ kullanılıyor: destek kartlarında nadirlik yok,
 * hepsi aynı kategoride ve etkileri doğrudan karşılaştırılabilir.
 * Karşılaştırma için: en pahalı araç 3600 jant; güç 4 bir destek kartı 4200.
 */
const PRICE_BY_POWER: Record<SupportPower, CardPrice> = {
  1: { rim: 0, coin: 0 },
  2: { rim: 1200, coin: 190 },
  3: { rim: 2600, coin: 400 },
  4: { rim: 4200, coin: 640 },
};

const price = (power: SupportPower): CardPrice => PRICE_BY_POWER[power];

/**
 * "Pit Ekibi" — support card pool (11 cards). Designed 2026-09-12.
 * Güç 1 olan üçü başlangıçta açık, kalanı jant/coin ile açılıyor.
 * None of them take a board slot and none cost fuel — see SupportAbilityKind
 * doc comment in src/types/index.ts for the full rules rationale.
 */
export const SUPPORT_CARDS: SupportCard[] = [
  {
    id: 'quick-fix',
    name: 'Hızlı Tamir',
    kind: 'HEAL_VEHICLE',
    target: 'ownVehicle',
    value: 4,
    emoji: '🔧',
    color: '#34D399',
    flavor: 'Bir tornavida, bir umut.',
    power: 1,
    price: price(1),
  },
  {
    id: 'checkpoint',
    name: 'Checkpoint',
    kind: 'HEAL_GARAGE',
    target: 'none',
    value: 6,
    emoji: '🏁',
    color: '#22C55E',
    flavor: 'Yeniden doğuş noktası.',
    power: 1,
    price: price(1),
  },
  {
    id: 'spare-shield',
    name: 'Yedek Kalkan',
    kind: 'SHIELD',
    target: 'ownVehicle',
    value: 50,
    emoji: '🛡️',
    color: '#60A5FA',
    flavor: 'Görünmez ama işe yarıyor.',
    power: 1,
    price: price(1),
  },
  {
    id: 'sacrifice-play',
    name: 'Feda Manevrası',
    kind: 'REDIRECT',
    target: 'ownVehicle',
    value: 0,
    emoji: '🔀',
    color: '#F59E0B',
    flavor: 'Bazen biri öne atılmalı.',
    power: 2,
    price: price(2),
  },
  {
    id: 'ambush',
    name: 'Pusu',
    kind: 'AMBUSH',
    target: 'none',
    value: 3,
    emoji: '🎯',
    color: '#EF4444',
    flavor: 'Hiç görmedi geleni.',
    power: 2,
    price: price(2),
  },
  {
    id: 'turbo-charge',
    name: 'Turbo Şarj',
    kind: 'FUEL_BOOST',
    target: 'none',
    value: 2,
    emoji: '⛽',
    color: '#FB923C',
    flavor: 'Depoya fazladan bir tur.',
    power: 4,
    price: price(4),
  },
  {
    id: 'cold-start',
    name: 'Soğuk Başlangıç',
    kind: 'FREE_PLAY',
    target: 'none',
    value: 0,
    emoji: '🔑',
    color: '#A78BFA',
    flavor: "Bir kerelik, üstüne yok.",
    power: 4,
    price: price(4),
  },
  {
    id: 'engine-trouble',
    name: 'Motor Arızası',
    kind: 'CANCEL_ATTACK',
    target: 'enemyVehicle',
    value: 1,
    emoji: '💢',
    color: '#F87171',
    flavor: 'Sabahları hep böyle başlar.',
    power: 3,
    price: price(3),
  },
  {
    id: 'road-block',
    name: 'Yol Kapama',
    kind: 'DISABLE',
    target: 'enemyVehicle',
    value: 1,
    emoji: '🚧',
    color: '#FBBF24',
    flavor: 'Bir dahaki sefere.',
    power: 3,
    price: price(3),
  },
  {
    id: 'last-chance',
    name: 'Son Şans',
    kind: 'REVIVE',
    target: 'ownVehicle',
    value: 0,
    emoji: '🍀',
    color: '#4ADE80',
    flavor: 'Son ana kadar pes yok.',
    power: 3,
    price: price(3),
  },
  {
    id: 'mind-scramble',
    name: 'Kafa Karıştır',
    kind: 'DISRUPT_HAND',
    target: 'none',
    value: 0,
    emoji: '🌀',
    color: '#C084FC',
    flavor: "Plan B'ye hoş geldin.",
    power: 4,
    price: price(4),
  },
];

const SUPPORT_BY_ID: Record<string, SupportCard> = Object.fromEntries(
  SUPPORT_CARDS.map((c) => [c.id, c]),
);

export function getSupportCard(id: string): SupportCard {
  const card = SUPPORT_BY_ID[id];
  if (!card) throw new Error(`Unknown support card id: ${id}`);
  return card;
}

/** Havuzun tamamı — bot buradan seçer (bot sahiplikle sınırlı değil). */
export const SUPPORT_CARD_IDS: string[] = SUPPORT_CARDS.map((c) => c.id);

/** Güç 1 destek kartları başlangıçta açık (fiyatları 0). */
export const STARTER_SUPPORT_IDS: string[] = SUPPORT_CARDS.filter((c) => c.price.rim === 0).map(
  (c) => c.id,
);
