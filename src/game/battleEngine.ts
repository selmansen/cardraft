/**
 * CarDraft turn-based battle engine (Faz 1).
 *
 * Pure, UI-agnostic. The screen (and the bot) mutate battle state only through
 * `applyAction`. Every function returns a NEW state object (deep-cloned), so the
 * caller can keep the previous state for animation/undo purposes.
 *
 * Model (Hearthstone-lite):
 *  - Each side has a garage with HP. Reduce the enemy garage to 0 to win.
 *  - "Fuel" is the resource (starts at 1, +1 max per turn, capped at 10).
 *  - A deck is 2 copies of every loadout card, shuffled. Draw 3 to open,
 *    then 1 at the start of each of your turns. Empty deck => fatigue damage.
 *  - Board holds up to 5 vehicles per side.
 *  - A vehicle can't attack the turn it's deployed unless it has RUSH or NITRO.
 *  - When A attacks B, both deal damage to each other (retaliation), unless A is
 *    much faster than B (speed lead >= 3), in which case A takes no retaliation.
 *  - "Pit Ekibi" (support) cards share the deck/hand with vehicles but never
 *    board and never cost fuel — at most one per turn instead (see
 *    SupportAbilityKind in src/types for the full effect list).
 */

import { getCard } from '@/data/cards';
import { getSupportCard } from '@/data/supportCards';
import type { Ability, AbilityKind, SupportAbilityKind, SupportCard, SupportTargetKind } from '@/types';
import { nextInt, pickRandom, seedFromString, shuffleWith, type RngHolder } from './rng';

export const GARAGE_HP = 30;
export const MAX_FUEL = 10;
/** Three, not five: five vehicles wrapped onto a second row on a phone, which
 *  made the whole board jump every time a card landed or died. Three is what
 *  fits one row at a readable card size — and with the scrap rule in
 *  `playCard` a full board is a decision point rather than a dead end. */
export const BOARD_LIMIT = 3;
export const HAND_LIMIT = 7;
export const OPENING_HAND = 3;
export const DECK_COPIES = 2;
/** Speed lead needed to dodge retaliation. */
export const EVADE_SPEED_LEAD = 3;

export type SideId = 'player' | 'bot';

/**
 * Kadrodaki bir kart. Eskiden `level` de taşıyordu; kart seviyesi sistemi
 * kaldırıldığı için artık sadece kimlik. Sunucu maç doğrularken bu yapıyı
 * dondurup saklıyor — sade olması, doğrulamanın kırılabileceği bir alan daha
 * olmaması demek.
 */
export interface LoadoutEntry {
  cardId: string;
}

export interface BattleCard {
  kind: 'vehicle';
  uid: string;
  cardId: string;
  name: string;
  emoji: string;
  color: string;
  cost: number;
  attack: number;
  health: number;
  speed: number;
  abilities: Ability[];
}

export interface Vehicle extends BattleCard {
  maxHealth: number;
  /** Extra attack from NITRO this turn; cleared at the start of your next turn. */
  tempAttack: number;
  canAttack: boolean;
  justSummoned: boolean;
  /** Halves the next hit this vehicle takes (Pit Ekibi "Yedek Kalkan"), then clears. */
  shieldActive: boolean;
  /** >0: skip the canAttack=true reset for this many of the vehicle's own start-of-turn resets (Pit Ekibi "Motor Arızası"/"Yol Kapama"). */
  disabledTurns: number;
  /** TWIN ("İkiz Vuruş"): has this vehicle already taken its second swing this turn? Reset at the start of every turn. */
  usedExtraAttack: boolean;
}

/**
 * A Pit Ekibi (support) card sitting in a hand or deck. Never boards, never
 * costs fuel — see the SupportAbilityKind doc comment in src/types for why.
 */
export interface SupportBattleCard {
  kind: 'support';
  uid: string;
  cardId: string;
  name: string;
  emoji: string;
  color: string;
  /** Always 0 — kept so `.cost <= fuel` checks written for vehicles still work unchanged. */
  cost: 0;
  ability: SupportAbilityKind;
  target: SupportTargetKind;
  value: number;
}

export type HandCard = BattleCard | SupportBattleCard;

export interface Side {
  id: SideId;
  garageHp: number;
  garageMaxHp: number;
  fuel: number;
  maxFuel: number;
  deck: HandCard[];
  hand: HandCard[];
  board: Vehicle[];
  fatigue: number;
  /** At most one Pit Ekibi card per turn — reset at the start of each of this side's turns. */
  supportPlayedThisTurn: boolean;
  /** Set by "Feda Manevrası": the next attack that would hit this side's garage
   *  hits this vehicle instead. Cleared on use or at the start of this side's next turn. */
  redirectUid: string | null;
  /** "Soğuk Başlangıç" credits: this many upcoming vehicle plays cost 0 fuel this turn. */
  freePlayCredits: number;
}

export interface BattleOptions {
  /** Bot garage HP (Easy mode lowers this). Default GARAGE_HP. */
  botGarageHp?: number;
  playerGarageHp?: number;
  /** Cards drawn into the opening hand, per side. Default OPENING_HAND. */
  playerOpeningHand?: number;
  botOpeningHand?: number;
  /** Pit Ekibi card ids in each side's deck. Faz 1: the bot doesn't play any yet. */
  playerSupportLoadout?: string[];
  botSupportLoadout?: string[];
  /**
   * Maçın tohumu. Sunucu üretir, istemciye verir; maç doğrulanırken sunucu
   * aynı tohumla yeniden oynatır. Verilmezse rastgele bir tohum üretilir —
   * yalnızca sunucusuz/yerel oynanışta anlamlı.
   */
  seed?: string;
}

export interface LogEntry {
  id: number;
  text: string;
  kind: 'info' | 'attack' | 'ability' | 'death' | 'turn' | 'result';
  /** Whose action this entry reports, for 'attack'/'ability' entries — lets
   *  the UI color-code "what I did" vs "what the opponent did" instead of
   *  a single flat tone for every combat line. Undefined where it isn't
   *  meaningful (info/turn/result/death). */
  side?: SideId;
}

export interface BattleState extends RngHolder {
  turn: number;
  active: SideId;
  player: Side;
  bot: Side;
  log: LogEntry[];
  winner: SideId | null;
  /**
   * Rastgeleliğin durumu. State'in parçası olması şart: klonlanıyor, JSON'a
   * çevrilebiliyor ve her aksiyondan sonra ilerlemiş hâliyle taşınıyor.
   * Aynı tohumla başlayan ve aynı aksiyonları alan iki çalıştırma birebir
   * aynı sonucu veriyor — sunucunun maçı doğrulayabilmesinin temeli bu.
   */
  rngState: number;
  /** Kart kimliği sayacı — rngState ile aynı sebeple state'te. */
  uidCounter: number;
}

export type BattleAction =
  // `scrapUid`: which of your own vehicles to scrap for the newcomer, used
  // (and required) only when the board is already full — see playCard.
  | { type: 'PLAY'; side: SideId; handIndex: number; scrapUid?: string }
  | { type: 'PLAY_SUPPORT'; side: SideId; handIndex: number; targetUid?: string }
  | { type: 'ATTACK'; side: SideId; attackerUid: string; target: 'garage' | string }
  | { type: 'END_TURN' };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Kart kimlikleri de deterministik olmak ZORUNDA.
 *
 * Sayaç eskiden modül düzeyindeydi: aynı süreçte kaç maç açıldığına göre
 * numaralar kayıyordu. Sunucu doğrulamada kendi motorunu çalıştırdığında
 * araçlar farklı uid alıyor, istemcinin "pv-3 ile saldırdım" hamlesi
 * sunucuda hiçbir araca denk gelmiyordu — hamle sessizce hiçbir şey yapmıyor
 * ve maç sonuçlanmamış görünüyordu.
 *
 * Sayaç artık state'in içinde: aynı tohum + aynı kurulum, her zaman aynı
 * kimlikler.
 */
interface UidHolder {
  uidCounter: number;
}
function nextUid(holder: UidHolder, prefix: string): string {
  holder.uidCounter += 1;
  return `${prefix}-${holder.uidCounter}`;
}

let logCounter = 0;
function pushLog(state: BattleState, kind: LogEntry['kind'], text: string, side?: SideId): void {
  logCounter += 1;
  state.log.push({ id: logCounter, kind, text, side });
  if (state.log.length > 40) state.log.splice(0, state.log.length - 40);
}

function clone(state: BattleState): BattleState {
  return JSON.parse(JSON.stringify(state)) as BattleState;
}

/** Deste karma — tohumdan türeyen RNG ile, `Math.random` ile değil. */
function shuffle<T>(holder: RngHolder, arr: T[]): T[] {
  return shuffleWith(holder, arr);
}

export function otherSide(id: SideId): SideId {
  return id === 'player' ? 'bot' : 'player';
}

function sideOf(state: BattleState, id: SideId): Side {
  return id === 'player' ? state.player : state.bot;
}

function hasAbility(card: { abilities: Ability[] }, kind: AbilityKind): boolean {
  return card.abilities.some((a) => a.kind === kind);
}

function abilityValue(card: { abilities: Ability[] }, kind: AbilityKind): number {
  return card.abilities.find((a) => a.kind === kind)?.value ?? 0;
}

/** Attack including NITRO bonus and CONVOY auras from friendly vehicles. */
export function effectiveAttack(vehicle: Vehicle, side: Side): number {
  const convoy = side.board
    .filter((v) => v.uid !== vehicle.uid)
    .reduce((sum, v) => sum + abilityValue(v, 'CONVOY'), 0);
  return Math.max(0, vehicle.attack + vehicle.tempAttack + convoy);
}

/** True if `side` has at least one living blocker on board. */
export function hasBlocker(side: Side): boolean {
  return side.board.some((v) => hasAbility(v, 'BLOCKER'));
}

/** Which enemy vehicles are legal attack targets right now. */
export function legalTargets(defenderSide: Side): { canHitGarage: boolean; vehicleUids: string[] } {
  const blockers = defenderSide.board.filter((v) => hasAbility(v, 'BLOCKER'));
  if (blockers.length > 0) {
    return { canHitGarage: false, vehicleUids: blockers.map((v) => v.uid) };
  }
  return { canHitGarage: true, vehicleUids: defenderSide.board.map((v) => v.uid) };
}

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

function buildBattleCard(uids: UidHolder, entry: LoadoutEntry, sidePrefix: string): BattleCard {
  const card = getCard(entry.cardId);
  return {
    kind: 'vehicle',
    uid: nextUid(uids, `${sidePrefix}c`),
    cardId: card.id,
    name: card.name,
    emoji: card.emoji,
    color: card.color,
    cost: card.cost,
    attack: card.attack,
    health: card.health,
    speed: card.speed,
    abilities: card.abilities.map((a) => ({ ...a })),
  };
}

function buildSupportBattleCard(uids: UidHolder, cardId: string, sidePrefix: string): SupportBattleCard {
  const card: SupportCard = getSupportCard(cardId);
  return {
    kind: 'support',
    uid: nextUid(uids, `${sidePrefix}s`),
    cardId: card.id,
    name: card.name,
    emoji: card.emoji,
    color: card.color,
    cost: 0,
    ability: card.kind,
    target: card.target,
    value: card.value,
  };
}

function buildDeck(
  rng: RngHolder,
  uids: UidHolder,
  loadout: LoadoutEntry[],
  supportLoadout: string[],
  sidePrefix: string,
): HandCard[] {
  const cards: HandCard[] = [];
  for (const entry of loadout) {
    for (let i = 0; i < DECK_COPIES; i += 1) {
      cards.push(buildBattleCard(uids, entry, sidePrefix));
    }
  }
  for (const cardId of supportLoadout) {
    for (let i = 0; i < DECK_COPIES; i += 1) {
      cards.push(buildSupportBattleCard(uids, cardId, sidePrefix));
    }
  }
  return shuffle(rng, cards);
}

function makeSide(
  rng: RngHolder,
  uids: UidHolder,
  id: SideId,
  loadout: LoadoutEntry[],
  supportLoadout: string[],
  openingHand: number,
  garageHp: number,
): Side {
  const deck = buildDeck(rng, uids, loadout, supportLoadout, id === 'player' ? 'p' : 'b');
  const hand = deck.splice(0, Math.max(0, openingHand));
  return {
    id,
    garageHp,
    garageMaxHp: garageHp,
    fuel: 0,
    maxFuel: 0,
    deck,
    hand,
    board: [],
    fatigue: 0,
    supportPlayedThisTurn: false,
    redirectUid: null,
    freePlayCredits: 0,
  };
}

export function createBattle(
  playerLoadout: LoadoutEntry[],
  botLoadout: LoadoutEntry[],
  opts: BattleOptions = {},
): BattleState {
  // Tohum verilmişse ondan, verilmemişse rastgele. Sunucu her zaman tohum
  // verir; tohumsuz yol yalnızca çevrimdışı/yerel oynanış için.
  const rng: RngHolder = {
    rngState: opts.seed
      ? seedFromString(opts.seed)
      : (Math.floor(Math.random() * 0xffffffff) >>> 0),
  };
  const uids: UidHolder = { uidCounter: 0 };
  const state: BattleState = {
    // Deste karıldıktan SONRAKİ durumla değiştirilecek (aşağıda).
    rngState: rng.rngState,
    uidCounter: 0,
    turn: 1,
    active: 'player',
    player: makeSide(
      rng,
      uids,
      'player',
      playerLoadout,
      opts.playerSupportLoadout ?? [],
      opts.playerOpeningHand ?? OPENING_HAND,
      opts.playerGarageHp ?? GARAGE_HP,
    ),
    bot: makeSide(
      rng,
      uids,
      'bot',
      botLoadout,
      opts.botSupportLoadout ?? [],
      opts.botOpeningHand ?? OPENING_HAND,
      opts.botGarageHp ?? GARAGE_HP,
    ),
    log: [],
    winner: null,
  };
  // Player takes the first turn with 1 fuel; the bot gets an extra card later
  // (start-of-turn draw) as light compensation for going second.
  // Desteler karılırken RNG ilerledi; state o ilerlemiş durumu taşımalı ki
  // maçın devamı da aynı diziden devam etsin.
  state.rngState = rng.rngState;
  state.uidCounter = uids.uidCounter;
  state.player.fuel = 1;
  state.player.maxFuel = 1;
  pushLog(state, 'turn', 'Savaş başladı. Sıra sende.');
  return state;
}

// ---------------------------------------------------------------------------
// turn flow
// ---------------------------------------------------------------------------

function drawCard(state: BattleState, side: Side): void {
  if (side.deck.length === 0) {
    side.fatigue += 1;
    side.garageHp -= side.fatigue;
    pushLog(
      state,
      'ability',
      `${label(side)} destesi bitti. Yorgunluk ${side.fatigue} hasar.`,
    );
    return;
  }
  const card = side.deck.shift()!;
  if (side.hand.length >= HAND_LIMIT) {
    pushLog(state, 'info', `${label(side)} eli dolu. ${card.name} yandı.`);
    return;
  }
  side.hand.push(card);
}

function startTurn(state: BattleState, sideId: SideId): void {
  const side = sideOf(state, sideId);
  side.maxFuel = Math.min(MAX_FUEL, side.maxFuel + 1);
  side.fuel = side.maxFuel;
  // Pit Ekibi resets: a fresh "1 per turn" allowance, a redirect only ever
  // covers the one enemy turn right after it's played, a free-play credit
  // that went unused expires rather than carrying forward.
  side.supportPlayedThisTurn = false;
  side.redirectUid = null;
  side.freePlayCredits = 0;
  for (const v of side.board) {
    v.tempAttack = 0;
    v.justSummoned = false;
    v.usedExtraAttack = false;
    if (v.disabledTurns > 0) {
      v.disabledTurns -= 1;
      v.canAttack = false;
    } else {
      v.canAttack = true;
    }
  }
  drawCard(state, side);
  pushLog(
    state,
    'turn',
    `Tur ${state.turn}: ${sideId === 'player' ? 'senin sıran' : 'rakip oynuyor'} (${side.fuel} yakıt).`,
  );
  checkWinner(state);
}

function label(side: Side): string {
  return side.id === 'player' ? 'Sen' : 'Rakip';
}

/** How to name a garage in a log line, from the FIXED point of view of the
 *  human player — never relative to whichever side happens to be acting.
 *  `targetSideId` is whichever garage is on the receiving end (i.e. `enemy.id`
 *  at the call site), so the same message reads correctly whether the player
 *  or the bot is the one dealing the hit: hitting the bot's garage is always
 *  "rakip garaj", hitting your own is always "garajın" — never the reverse. */
function garageWord(targetSideId: SideId, form: 'dative' | 'nominative' = 'dative'): string {
  if (targetSideId === 'bot') return form === 'dative' ? 'rakip garaja' : 'rakip garaj';
  return form === 'dative' ? 'garajına' : 'garajın';
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

function resolveDeaths(state: BattleState): void {
  for (const side of [state.player, state.bot]) {
    const survivors: Vehicle[] = [];
    for (const v of side.board) {
      if (v.health > 0) {
        survivors.push(v);
      } else {
        pushLog(state, 'death', `${v.name} (${label(side)}) parçalandı.`);
      }
    }
    side.board = survivors;
  }
}

function checkWinner(state: BattleState): void {
  if (state.winner) return;
  const playerDead = state.player.garageHp <= 0;
  const botDead = state.bot.garageHp <= 0;
  if (botDead) {
    state.winner = 'player';
    pushLog(state, 'result', 'Rakip garajı yıkıldı. KAZANDIN! 🏆');
  } else if (playerDead) {
    state.winner = 'bot';
    pushLog(state, 'result', 'Garajın yıkıldı. Kaybettin.');
  }
}

function damageGarage(state: BattleState, sideId: SideId, amount: number): void {
  const side = sideOf(state, sideId);
  side.garageHp = Math.max(0, side.garageHp - amount);
}

function healGarage(side: Side, amount: number): void {
  side.garageHp = Math.min(side.garageMaxHp, side.garageHp + amount);
}

function healVehicle(vehicle: Vehicle, amount: number): void {
  vehicle.health = Math.min(vehicle.maxHealth, vehicle.health + amount);
}

/** Applies damage to a vehicle, consuming its shield (halves it) if active.
 *  Every place that hurts a vehicle should go through this, so "Yedek
 *  Kalkan" works no matter which code path dealt the hit. Returns the
 *  actual damage applied (after the shield halving), for logging. */
function damageVehicle(vehicle: Vehicle, raw: number): number {
  let dmg = Math.max(0, raw);
  if (vehicle.shieldActive) {
    dmg = Math.ceil(dmg / 2);
    vehicle.shieldActive = false;
  }
  vehicle.health -= dmg;
  return dmg;
}

/** Marks an attacker as having attacked — unless it has TWIN ("İkiz Vuruş")
 *  and hasn't taken its second swing yet this turn, in which case it stays
 *  ready to attack again. */
function consumeAttack(attacker: Vehicle): void {
  if (hasAbility(attacker, 'TWIN') && !attacker.usedExtraAttack) {
    attacker.usedExtraAttack = true;
    return;
  }
  attacker.canAttack = false;
}

function applyEntryEffects(state: BattleState, sideId: SideId, vehicle: Vehicle): void {
  const enemy = sideOf(state, otherSide(sideId));

  if (hasAbility(vehicle, 'NITRO')) {
    vehicle.tempAttack = abilityValue(vehicle, 'NITRO');
    vehicle.canAttack = true;
    pushLog(state, 'ability', `${vehicle.name}: Nitro! (+${vehicle.tempAttack} güç, hemen saldırabilir)`, sideId);
  }
  if (hasAbility(vehicle, 'RUSH')) {
    vehicle.canAttack = true;
  }
  if (hasAbility(vehicle, 'BACKFIRE')) {
    const dmg = abilityValue(vehicle, 'BACKFIRE');
    damageGarage(state, enemy.id, dmg);
    pushLog(
      state,
      'ability',
      `${vehicle.name}: Egzoz patlaması, ${garageWord(enemy.id)} **${dmg} hasar** verdi.`,
      sideId,
    );
    checkWinner(state);
  }
  if (hasAbility(vehicle, 'RAM')) {
    const dmg = abilityValue(vehicle, 'RAM');
    const victims = enemy.board.filter((v) => v.uid !== vehicle.uid);
    if (victims.length > 0) {
      const target = pickRandom(state, victims)!;
      const applied = damageVehicle(target, dmg);
      pushLog(state, 'ability', `${vehicle.name}: Çarpma, ${target.name} **${applied} hasar** aldı.`, sideId);
      resolveDeaths(state);
    }
  }
  if (hasAbility(vehicle, 'CONVOY')) {
    pushLog(state, 'ability', `${vehicle.name}: Konvoy. Diğer araçların +${abilityValue(vehicle, 'CONVOY')} güç.`, sideId);
  }
}

/**
 * `scrapUid` is the full-board escape hatch: drop a card onto one of your own
 * vehicles and that vehicle is scrapped to make room for it. Only honoured
 * when the board is actually full — with a free slot the new vehicle just
 * takes the slot, so a stray drop onto a card can never burn one by accident.
 */
function playCard(state: BattleState, sideId: SideId, handIndex: number, scrapUid?: string): void {
  if (state.winner || state.active !== sideId) return;
  const side = sideOf(state, sideId);
  const card = side.hand[handIndex];
  if (!card || card.kind !== 'vehicle') return;
  const freePlay = side.freePlayCredits > 0;
  if (!freePlay && card.cost > side.fuel) return;

  const full = side.board.length >= BOARD_LIMIT;
  // Index the newcomer will occupy: the scrapped vehicle's own slot, so the
  // row doesn't reshuffle under the player's finger mid-swap.
  let slot = side.board.length;
  if (full) {
    if (!scrapUid) return;
    slot = side.board.findIndex((v) => v.uid === scrapUid);
    if (slot === -1) return;
  }

  side.hand.splice(handIndex, 1);
  if (freePlay) {
    side.freePlayCredits -= 1;
  } else {
    side.fuel -= card.cost;
  }

  const vehicle: Vehicle = {
    ...card,
    uid: nextUid(state, sideId === 'player' ? 'pv' : 'bv'),
    abilities: card.abilities.map((a) => ({ ...a })),
    maxHealth: card.health,
    tempAttack: 0,
    canAttack: false,
    justSummoned: true,
    shieldActive: false,
    disabledTurns: 0,
    usedExtraAttack: false,
  };
  if (full) {
    const scrapped = side.board[slot];
    side.board.splice(slot, 1, vehicle);
    // A scrap is a real event (it can lose you a blocker), so unlike the plain
    // "sahaya çıktı" line this one is announced.
    pushLog(
      state,
      'ability',
      `${scrapped.name} hurdaya ayrıldı, yerine ${card.name} geçti.`,
      sideId,
    );
  } else {
    side.board.splice(slot, 0, vehicle);
    pushLog(state, 'info', `${label(side)}: ${card.name} sahaya çıktı${freePlay ? ' (ücretsiz!)' : ''}.`);
  }
  applyEntryEffects(state, sideId, vehicle);
}

function attack(
  state: BattleState,
  sideId: SideId,
  attackerUid: string,
  target: 'garage' | string,
): void {
  if (state.winner || state.active !== sideId) return;
  const side = sideOf(state, sideId);
  const enemy = sideOf(state, otherSide(sideId));
  const attacker = side.board.find((v) => v.uid === attackerUid);
  if (!attacker || !attacker.canAttack || attacker.health <= 0) return;

  const targets = legalTargets(enemy);
  const atk = effectiveAttack(attacker, side);

  if (target === 'garage') {
    if (!targets.canHitGarage) return;
    consumeAttack(attacker);
    // "Feda Manevrası": the defender pre-committed a vehicle to take this hit
    // instead of the garage. One-shot — cleared the moment it's used.
    const redirectTo = enemy.redirectUid ? enemy.board.find((v) => v.uid === enemy.redirectUid) : null;
    if (redirectTo && redirectTo.health > 0) {
      enemy.redirectUid = null;
      const applied = damageVehicle(redirectTo, atk);
      pushLog(
        state,
        'attack',
        `${attacker.name} ${garageWord(enemy.id)} saldırmak istedi ama ${redirectTo.name} araya girip **${applied} hasar** aldı.`,
        sideId,
      );
      resolveDeaths(state);
      checkWinner(state);
      return;
    }
    damageGarage(state, enemy.id, atk);
    pushLog(state, 'attack', `${attacker.name} ${garageWord(enemy.id)} **${atk} hasar** verdi.`, sideId);
    checkWinner(state);
    return;
  }

  if (!targets.vehicleUids.includes(target)) return;
  const defender = enemy.board.find((v) => v.uid === target);
  if (!defender) return;

  const defAtk = effectiveAttack(defender, enemy);
  const evades = attacker.speed - defender.speed >= EVADE_SPEED_LEAD;
  const rawToAttacker = evades ? 0 : defAtk;

  const dmgToDefender = damageVehicle(defender, atk);
  const dmgToAttacker = rawToAttacker > 0 ? damageVehicle(attacker, rawToAttacker) : 0;
  consumeAttack(attacker);

  let attackMsg = `${attacker.name}, ${defender.name}'e **${dmgToDefender} hasar** verdi`;
  if (dmgToAttacker > 0) attackMsg += `, karşılığında **${dmgToAttacker} hasar** aldı.`;
  else if (evades) attackMsg += ', hasar almadan savuştu.';
  else attackMsg += '.';
  pushLog(state, 'attack', attackMsg, sideId);
  resolveDeaths(state);
  checkWinner(state);
}

/** Which uids `card` may legally target right now (empty for target: 'none'). */
export function legalSupportTargets(card: SupportBattleCard, side: Side, enemy: Side): string[] {
  if (card.target === 'ownVehicle') {
    if (card.ability === 'REVIVE') return side.board.filter((v) => v.health <= 1).map((v) => v.uid);
    return side.board.map((v) => v.uid);
  }
  if (card.target === 'enemyVehicle') return enemy.board.map((v) => v.uid);
  return [];
}

function playSupport(
  state: BattleState,
  sideId: SideId,
  handIndex: number,
  targetUid?: string,
): void {
  if (state.winner || state.active !== sideId) return;
  const side = sideOf(state, sideId);
  const enemy = sideOf(state, otherSide(sideId));
  const card = side.hand[handIndex];
  if (!card || card.kind !== 'support') return;
  if (side.supportPlayedThisTurn) return;

  if (card.target !== 'none') {
    const legal = legalSupportTargets(card, side, enemy);
    if (!targetUid || !legal.includes(targetUid)) return;
  }

  side.hand.splice(handIndex, 1);
  side.supportPlayedThisTurn = true;

  switch (card.ability) {
    case 'HEAL_VEHICLE': {
      const v = side.board.find((x) => x.uid === targetUid);
      if (v) {
        healVehicle(v, card.value);
        pushLog(state, 'ability', `${label(side)}: ${card.name}. ${v.name} +${card.value} can.`, side.id);
      }
      break;
    }
    case 'HEAL_GARAGE': {
      healGarage(side, card.value);
      pushLog(state, 'ability', `${label(side)}: ${card.name}. Garaj +${card.value} can.`, side.id);
      break;
    }
    case 'SHIELD': {
      const v = side.board.find((x) => x.uid === targetUid);
      if (v) {
        v.shieldActive = true;
        pushLog(state, 'ability', `${label(side)}: ${card.name}. ${v.name} bir sonraki hasara karşı korunuyor.`, side.id);
      }
      break;
    }
    case 'REDIRECT': {
      const v = side.board.find((x) => x.uid === targetUid);
      if (v) {
        side.redirectUid = v.uid;
        pushLog(state, 'ability', `${label(side)}: ${card.name}. Garaja gelecek darbe ${v.name}'e yönlenecek.`, side.id);
      }
      break;
    }
    case 'AMBUSH': {
      if (enemy.board.length > 0) {
        const victim = pickRandom(state, enemy.board)!;
        const applied = damageVehicle(victim, card.value);
        pushLog(state, 'ability', `${label(side)}: ${card.name}, ${victim.name} **${applied} hasar** aldı.`, side.id);
        resolveDeaths(state);
      } else {
        pushLog(state, 'ability', `${label(side)}: ${card.name}. Vurulacak rakip araç yok.`, side.id);
      }
      break;
    }
    case 'FUEL_BOOST': {
      side.fuel = Math.min(MAX_FUEL, side.fuel + card.value);
      pushLog(state, 'ability', `${label(side)}: ${card.name}. +${card.value} yakıt.`, side.id);
      break;
    }
    case 'FREE_PLAY': {
      side.freePlayCredits += 1;
      pushLog(state, 'ability', `${label(side)}: ${card.name}. Bir sonraki araç kartı ücretsiz.`, side.id);
      break;
    }
    case 'CANCEL_ATTACK':
    case 'DISABLE': {
      const v = enemy.board.find((x) => x.uid === targetUid);
      if (v) {
        v.disabledTurns += 1;
        pushLog(state, 'ability', `${label(side)}: ${card.name}. ${v.name} bir sonraki turda saldıramayacak.`, side.id);
      }
      break;
    }
    case 'REVIVE': {
      const v = side.board.find((x) => x.uid === targetUid);
      if (v) {
        v.health = v.maxHealth;
        pushLog(state, 'ability', `${label(side)}: ${card.name}. ${v.name} tam cana geldi.`, side.id);
      }
      break;
    }
    case 'DISRUPT_HAND': {
      const count = enemy.hand.length;
      enemy.deck.push(...enemy.hand);
      enemy.hand = [];
      enemy.deck = shuffle(state, enemy.deck);
      for (let i = 0; i < count; i += 1) drawCard(state, enemy);
      pushLog(state, 'ability', `${label(side)}: ${card.name}. ${label(enemy)} elini karıştırdı.`, side.id);
      break;
    }
  }
  checkWinner(state);
}

/** WEAR ("Yıpratma"): at the end of every turn a vehicle survives on board,
 *  it chips a random enemy vehicle. Runs once per END_TURN, for the side
 *  whose turn is ending — a WEAR vehicle only "counts" the turns it actually
 *  stood through. */
function applyWearEffects(state: BattleState, sideId: SideId): void {
  const side = sideOf(state, sideId);
  const enemy = sideOf(state, otherSide(sideId));
  for (const v of side.board) {
    if (v.health <= 0 || !hasAbility(v, 'WEAR')) continue;
    if (enemy.board.length === 0) continue;
    const dmg = abilityValue(v, 'WEAR');
    const target = pickRandom(state, enemy.board)!;
    const applied = damageVehicle(target, dmg);
    pushLog(state, 'ability', `${v.name}: Yıpratma, ${target.name} **${applied} hasar** aldı.`, sideId);
  }
  resolveDeaths(state);
  checkWinner(state);
}

// ---------------------------------------------------------------------------
// public reducer
// ---------------------------------------------------------------------------

/**
 * The single entry point for changing battle state. Returns a fresh state.
 * END_TURN switches the active side and runs its start-of-turn (draw + fuel).
 */
export function applyAction(prev: BattleState, action: BattleAction): BattleState {
  const state = clone(prev);
  if (state.winner) return state;

  switch (action.type) {
    case 'PLAY':
      playCard(state, action.side, action.handIndex, action.scrapUid);
      break;
    case 'PLAY_SUPPORT':
      playSupport(state, action.side, action.handIndex, action.targetUid);
      break;
    case 'ATTACK':
      attack(state, action.side, action.attackerUid, action.target);
      break;
    case 'END_TURN': {
      applyWearEffects(state, state.active);
      if (!state.winner) {
        const next = otherSide(state.active);
        state.active = next;
        state.turn += 1;
        startTurn(state, next);
      }
      break;
    }
  }
  return state;
}

/** Convenience: has the given side got any move worth making? (used by UI hints) */
export function sideHasPlay(state: BattleState, sideId: SideId): boolean {
  const side = sideOf(state, sideId);
  const canPlayVehicle =
    side.board.length < BOARD_LIMIT &&
    side.hand.some((c) => c.kind === 'vehicle' && c.cost <= side.fuel);
  const canPlaySupport = !side.supportPlayedThisTurn && side.hand.some((c) => c.kind === 'support');
  const canAttack = side.board.some((v) => v.canAttack && v.health > 0);
  return canPlayVehicle || canPlaySupport || canAttack;
}
