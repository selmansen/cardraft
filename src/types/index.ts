/**
 * Core domain types for CarDraft (Faz 1).
 *
 * A "Card" is static design data (see src/data/cards.ts).
 * A "CardInstance" is what the player owns: a card id + how many copies.
 */

export type VehicleClass =
  | 'sports' // Spor Araba — hız, düşük HP, patlama hasarı
  | 'monster' // Canavar Kamyon — yüksek HP, ezme (RAM), yavaş
  | 'utility' // Hizmet & Acil Durum — tamir, siper, destek
  | 'classic' // Klasik Araba — takım aurası (CONVOY), sağlam, yavaş
  | 'offroad' // Arazi / Off-Road — yüksek hız, misilleme kaçışı, mobilite
  | 'future' // Gelecek / Elektrikli — zırh + garaja enerji boşalımı
  | 'construction'; // İş Makinesi — bariyer (BLOCKER) + yıkım (RAM)

/** Display order for collection / galleries. */
export const VEHICLE_CLASSES: VehicleClass[] = [
  'sports',
  'offroad',
  'classic',
  'future',
  'utility',
  'monster',
  'construction',
];

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * Simple, non-complex card effects for Faz 1.
 * - RUSH:     Can attack the same turn it is deployed.
 * - NITRO:    Enters with +value attack and can attack immediately; the bonus
 *             fades at the start of your next turn.
 * - RAM:      On deploy, deals `value` damage to a random enemy vehicle.
 * - BLOCKER:  Enemy vehicles must attack blockers before anything else
 *             (a "taunt"). The enemy garage cannot be hit while a blocker lives.
 * - BACKFIRE: On deploy, deals `value` damage to the enemy garage.
 * - CONVOY:   While alive, your other vehicles get +value attack (aura).
 * - WEAR:     At the end of every turn it survives on board, deals `value`
 *             damage to a random enemy vehicle ("Yıpratma").
 * - TWIN:     Can attack twice per turn instead of once ("İkiz Vuruş") —
 *             cards with this are given a lower base attack to compensate.
 *
 * REPAIR and ARMOR existed here in Faz 1 but were retired (2026-09-12) once
 * Pit Ekibi (support cards, see SupportAbilityKind below) took over healing
 * and damage-mitigation as a player choice instead of a passive vehicle trait
 * — WEAR and TWIN replaced them on the affected cards to keep vehicles
 * offense/board-presence focused, distinct from what a support card does.
 */
export type AbilityKind =
  | 'RUSH'
  | 'NITRO'
  | 'RAM'
  | 'BLOCKER'
  | 'BACKFIRE'
  | 'CONVOY'
  | 'WEAR'
  | 'TWIN';

export interface Ability {
  kind: AbilityKind;
  value?: number;
}

export interface Card {
  id: string;
  name: string;
  class: VehicleClass;
  rarity: Rarity;
  /** Emoji stand-in for card art (real art is a Faz 1 open question). */
  emoji: string;
  /** Accent colour used by the procedural card art. */
  color: string;
  /** Fuel cost to deploy. */
  cost: number;
  attack: number;
  health: number;
  /** 1..10 — high speed lets a vehicle evade slow retaliation. */
  speed: number;
  abilities: Ability[];
  flavor: string;
  /** Kartın açılış bedeli. `rim === 0` ise başlangıçta sahip olunur. */
  price: CardPrice;
}

/**
 * Bir kartın iki fiyatı — League of Legends'ın "mavi öz / RP" düzeni.
 *
 * Aynı kart hem oynayarak (jant) hem para ödeyerek (coin) alınabiliyor. Ödeme
 * yapan oyuncu ZAMAN satın alıyor, güç değil: kartın kendisi her iki yolda da
 * aynı. Yükseltme sistemi tam bu yüzden kaldırıldı — parayla stat almak
 * mümkün olsaydı model çökerdi.
 */
export interface CardPrice {
  /** Oynayarak kazanılan para (arayüzde "jant"). 0 = başlangıçta açık. */
  rim: number;
  /** Gerçek parayla alınan para. 0 = başlangıçta açık. */
  coin: number;
}

/** Oyuncunun bir kartı hangi kesenin parasıyla aldığı. */
export type Currency = 'rim' | 'coin';

export interface CardInstance {
  cardId: string;
  /**
   * Duplicate copies owned.
   *
   * Kart seviyesi/yükseltme sistemi kaldırıldı: yükseltme stat artışı
   * veriyordu, yani parayla güç satılabilir hâle getiriyordu. Yeni ekonomide
   * (jant/coin) para sadece kart AÇMAYI hızlandırıyor, güç vermiyor — bu
   * yüzden kartlar sabit güçte. Kopya sayısı duruyor: ileride "5 kopya → kartı
   * aç" gibi bir eşik mekaniği için.
   */
  count: number;
}

// ---------------------------------------------------------------------------
// Pit Ekibi (support cards) — Faz 1, added 2026-09-12.
//
// A support card never takes a board slot: it resolves once and is gone.
// Unlike vehicles it costs no fuel (Pokémon TCG's Item/Supporter model) — the
// throttle is "at most 1 per turn" instead, enforced in battleEngine.
// - HEAL_VEHICLE:   restores `value` HP to a chosen own vehicle.
// - HEAL_GARAGE:    restores `value` HP to your own garage.
// - SHIELD:         halves (value = % reduction) the next hit a chosen own
//                    vehicle takes, whichever side dealt it.
// - REDIRECT:       the next enemy attack that would hit your garage this
//                    "window" hits the chosen own vehicle instead.
// - AMBUSH:         `value` damage to a random enemy vehicle, right away.
// - FUEL_BOOST:     +`value` fuel this turn.
// - FREE_PLAY:      your next vehicle card this turn costs 0 fuel.
// - CANCEL_ATTACK:  the chosen enemy vehicle can't attack next turn.
// - DISABLE:        same as CANCEL_ATTACK — kept as a separate card for deck
//                    variety, may get its own effect later.
// - REVIVE:         a chosen own vehicle at 1 HP is restored to full.
// - DISRUPT_HAND:   the enemy's whole hand is shuffled back into their deck
//                    and they draw the same number of fresh cards.
// ---------------------------------------------------------------------------

export type SupportAbilityKind =
  | 'HEAL_VEHICLE'
  | 'HEAL_GARAGE'
  | 'SHIELD'
  | 'REDIRECT'
  | 'AMBUSH'
  | 'FUEL_BOOST'
  | 'FREE_PLAY'
  | 'CANCEL_ATTACK'
  | 'DISABLE'
  | 'REVIVE'
  | 'DISRUPT_HAND';

/** Which side (if any) the player must pick a target from before playing. */
export type SupportTargetKind = 'none' | 'ownVehicle' | 'enemyVehicle';

/**
 * Pit Ekibi kartının etki gücü, 1 (basit) → 4 (oyun çeviren).
 *
 * Fiyatlandırmanın dayanağı bu. Araç kartlarında nadirlik bu işi görüyor ama
 * Pit Ekibi'nde nadirlik yok — hepsi tek bir kategorinin içinde ve etkileri
 * doğrudan karşılaştırılabilir, o yüzden gücü elle işaretliyoruz.
 */
export type SupportPower = 1 | 2 | 3 | 4;

export interface SupportCard {
  id: string;
  name: string;
  kind: SupportAbilityKind;
  target: SupportTargetKind;
  value: number;
  emoji: string;
  color: string;
  flavor: string;
  /** Etki gücü — fiyatı bu belirliyor. */
  power: SupportPower;
  /** Açılış bedeli. `rim === 0` ise başlangıçta açık. */
  price: CardPrice;
}
