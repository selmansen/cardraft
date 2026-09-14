/**
 * Faz 1 bot: a readable greedy planner. It returns an ordered list of actions
 * (never END_TURN — the screen appends that) so the UI can play them out one at
 * a time with animation delays.
 *
 * Play phase:  spend fuel on the highest-value affordable card, repeat.
 * Attack phase: clear enemy blockers, take favourable trades, otherwise go face.
 */

import { nextRandom, pickRandom, type RngHolder } from './rng';
import {
  applyAction,
  effectiveAttack,
  hasBlocker,
  legalTargets,
  type BattleAction,
  type BattleState,
  type Side,
  type Vehicle,
  BOARD_LIMIT,
} from './battleEngine';

const BOT: 'bot' = 'bot';

function cardValue(c: { attack: number; health: number; abilities: { kind: string }[] }): number {
  const abilityBonus = c.abilities.reduce((n, a) => {
    if (a.kind === 'BLOCKER') return n + 2;
    if (a.kind === 'NITRO' || a.kind === 'RUSH') return n + 1;
    if (a.kind === 'RAM' || a.kind === 'BACKFIRE' || a.kind === 'WEAR') return n + 1;
    if (a.kind === 'CONVOY' || a.kind === 'TWIN') return n + 2;
    return n;
  }, 0);
  return c.attack + c.health + abilityBonus;
}

/** What a vehicle already on board is worth right now — uses its CURRENT
 *  health, so a chewed-up blocker is correctly cheap to scrap. */
function boardValue(v: Vehicle): number {
  return cardValue({ attack: v.attack + v.tempAttack, health: v.health, abilities: v.abilities });
}

/** How much better a newcomer has to be before the bot scraps one of its own
 *  to make room. Low enough that it does use the mechanic, high enough that
 *  it doesn't throw away a healthy vehicle for a marginal upgrade. */
const SCRAP_MARGIN = 4;

interface PlayPick {
  handIndex: number;
  /** Set only when the board is full and the bot is swapping something out. */
  scrapUid?: string;
}

/** Pick the next best card to play given current fuel/board, or null. */
function chooseCardToPlay(bot: Side): PlayPick | null {
  let bestIndex: number | null = null;
  let bestScore = -Infinity;
  bot.hand.forEach((card, i) => {
    if (card.kind !== 'vehicle') return;
    if (card.cost > bot.fuel) return;
    // Prefer higher value; break ties by spending more fuel this turn.
    const score = cardValue(card) * 10 + card.cost;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });
  if (bestIndex == null) return null;

  if (bot.board.length < BOARD_LIMIT) return { handIndex: bestIndex };

  // Board full: the same scrap swap the player gets. Only worth it against
  // the weakest thing out there, and only by a clear margin.
  const candidate = bot.hand[bestIndex];
  if (candidate.kind !== 'vehicle') return null;
  const weakest = [...bot.board].sort((a, b) => boardValue(a) - boardValue(b))[0];
  if (!weakest) return null;
  if (cardValue(candidate) - boardValue(weakest) < SCRAP_MARGIN) return null;
  return { handIndex: bestIndex, scrapUid: weakest.uid };
}

interface SupportPick {
  handIndex: number;
  targetUid?: string;
}

/**
 * Which Pit Ekibi card (if any) is worth playing right now — at most one per
 * turn, same rule the player has. Each ability gets one plain "is this
 * actually useful this turn" test rather than a scoring model: a card that
 * would fizzle (healing a full-health vehicle, ambushing an empty board) is
 * skipped entirely so the bot doesn't waste its one slot on nothing.
 *
 * Called before the play phase on purpose: the two fuel-shaped abilities
 * (FUEL_BOOST, FREE_PLAY) only pay off if the vehicles they enable are still
 * to come.
 */
function chooseSupportToPlay(state: BattleState): SupportPick | null {
  const bot = state.bot;
  const player = state.player;
  if (bot.supportPlayedThisTurn) return null;

  const damaged = [...bot.board]
    .filter((v) => v.health < v.maxHealth)
    .sort((a, b) => a.health - b.health)[0];
  const strongestOwn = [...bot.board].sort((a, b) => boardValue(b) - boardValue(a))[0];
  const weakestOwn = [...bot.board].sort((a, b) => boardValue(a) - boardValue(b))[0];
  const nearDeath = bot.board.find((v) => v.health <= 1);
  const enemyThreat = [...player.board]
    .filter((v) => v.health > 0)
    .sort((a, b) => effectiveAttack(b, player) - effectiveAttack(a, player))[0];
  const garagePct = bot.garageHp / Math.max(1, bot.garageMaxHp);
  const cheapestUnaffordable = bot.hand
    .filter((c) => c.kind === 'vehicle' && c.cost > bot.fuel)
    .sort((a, b) => a.cost - b.cost)[0];
  const priciestAffordableSoon = bot.hand
    .filter((c) => c.kind === 'vehicle')
    .sort((a, b) => b.cost - a.cost)[0];

  for (let i = 0; i < bot.hand.length; i += 1) {
    const card = bot.hand[i];
    if (card.kind !== 'support') continue;

    switch (card.ability) {
      case 'REVIVE':
        if (nearDeath) return { handIndex: i, targetUid: nearDeath.uid };
        break;
      case 'HEAL_VEHICLE':
        // Only when there's real damage to undo, not a scratch.
        if (damaged && damaged.maxHealth - damaged.health >= Math.min(3, card.value))
          return { handIndex: i, targetUid: damaged.uid };
        break;
      case 'HEAL_GARAGE':
        if (garagePct <= 0.6) return { handIndex: i };
        break;
      case 'SHIELD':
        if (strongestOwn && enemyThreat) return { handIndex: i, targetUid: strongestOwn.uid };
        break;
      case 'REDIRECT':
        // Throw the cheapest body in front of the garage, and only when the
        // garage is actually the thing at risk.
        if (weakestOwn && garagePct <= 0.5 && !hasBlocker(bot))
          return { handIndex: i, targetUid: weakestOwn.uid };
        break;
      case 'AMBUSH':
        if (player.board.length > 0) return { handIndex: i };
        break;
      case 'CANCEL_ATTACK':
      case 'DISABLE':
        if (enemyThreat && effectiveAttack(enemyThreat, player) >= 3)
          return { handIndex: i, targetUid: enemyThreat.uid };
        break;
      case 'FUEL_BOOST':
        if (cheapestUnaffordable && cheapestUnaffordable.cost <= bot.fuel + card.value)
          return { handIndex: i };
        break;
      case 'FREE_PLAY':
        if (priciestAffordableSoon && priciestAffordableSoon.cost >= 4) return { handIndex: i };
        break;
      case 'DISRUPT_HAND':
        if (player.hand.length >= 4) return { handIndex: i };
        break;
    }
  }
  return null;
}

interface AttackPick {
  attackerUid: string;
  target: 'garage' | string;
}

function chooseAttack(state: BattleState): AttackPick | null {
  const bot = state.bot;
  const player = state.player;
  const attackers = bot.board.filter((v) => v.canAttack && v.health > 0);
  if (attackers.length === 0) return null;

  const targets = legalTargets(player);

  for (const attacker of attackers) {
    const atk = effectiveAttack(attacker, bot);

    // 1) Blockers must be dealt with — hit the one we're most likely to kill.
    if (hasBlocker(player)) {
      const blockers = player.board
        .filter((v) => targets.vehicleUids.includes(v.uid))
        .sort((a, b) => a.health - b.health);
      const lethal = blockers.find((b) => atk >= b.health);
      const pick = lethal ?? blockers[0];
      if (pick) return { attackerUid: attacker.uid, target: pick.uid };
      continue;
    }

    // 2) Favourable trade: kill an enemy vehicle and survive its retaliation.
    const trade = bestTrade(attacker, atk, player.board, player);
    if (trade) return { attackerUid: attacker.uid, target: trade.uid };

    // 3) Otherwise punch the garage.
    if (targets.canHitGarage) return { attackerUid: attacker.uid, target: 'garage' };
  }

  // Nobody found a face/ trade lane (e.g. all would be bad trades) — just take
  // the least-bad vehicle hit with the first attacker so the turn progresses.
  const first = attackers[0];
  if (targets.canHitGarage) return { attackerUid: first.uid, target: 'garage' };
  if (player.board.length > 0) {
    const weakest = [...player.board].sort((a, b) => a.health - b.health)[0];
    return { attackerUid: first.uid, target: weakest.uid };
  }
  return null;
}

function bestTrade(
  attacker: Vehicle,
  atk: number,
  enemyBoard: Vehicle[],
  enemySide: Side,
): Vehicle | null {
  let best: Vehicle | null = null;
  let bestGain = 0;
  for (const enemy of enemyBoard) {
    const kills = atk >= enemy.health;
    if (!kills) continue;
    const retaliation = effectiveAttack(enemy, enemySide);
    const survives = attacker.speed - enemy.speed >= 3 || attacker.health > retaliation;
    if (!survives) continue;
    const gain = enemy.attack + enemy.health;
    if (gain > bestGain) {
      bestGain = gain;
      best = enemy;
    }
  }
  return best;
}

/** Lowest-value affordable card — used when the bot "blunders" (Easy mode).
 *  Never scraps: throwing away a vehicle is exactly the kind of move a
 *  blunder shouldn't be allowed to make on the player's behalf. */
function chooseWeakCardToPlay(bot: Side): PlayPick | null {
  if (bot.board.length >= BOARD_LIMIT) return null;
  let worstIndex: number | null = null;
  let worstScore = Infinity;
  bot.hand.forEach((card, i) => {
    if (card.kind !== 'vehicle') return;
    if (card.cost > bot.fuel) return;
    const score = cardValue(card);
    if (score < worstScore) {
      worstScore = score;
      worstIndex = i;
    }
  });
  return worstIndex == null ? null : { handIndex: worstIndex };
}

/** A legal but careless attack: random attacker → random legal target. */
function chooseWeakAttack(state: BattleState, rng: RngHolder): AttackPick | null {
  const attackers = state.bot.board.filter((v) => v.canAttack && v.health > 0);
  if (attackers.length === 0) return null;
  const attacker = pickRandom(rng, attackers)!;
  const targets = legalTargets(state.player);
  const pool: (string | 'garage')[] = [...targets.vehicleUids];
  if (targets.canHitGarage) pool.push('garage');
  if (pool.length === 0) return null;
  return { attackerUid: attacker.uid, target: pickRandom(rng, pool)! };
}

/**
 * Produce the bot's full action list for its current turn. Pure: works on a
 * private clone via `applyAction`.
 *
 * `blunderChance` (0..1): at each decision the bot may deliberately make a weak
 * move — plays its worst card, attacks randomly, or stops early. Easy mode
 * raises this so a new player can actually win.
 */
export function planBotTurn(startState: BattleState, blunderChance = 0): BattleAction[] {
  const actions: BattleAction[] = [];
  let state = startState;
  let guard = 0;
  /**
   * Botun kendi rastgele kararları (blunder, gelişigüzel saldırı) da
   * deterministik olmalı — sunucu maçı doğrularken botu YENİDEN planlıyor ve
   * aynı kararları üretmesi gerekiyor.
   *
   * Yerel bir taşıyıcı kullanılıyor, `startState` mutasyona uğratılmıyor:
   * planlama saf kalsın, çağıran state'i beklenmedik şekilde değişmesin.
   * Determinizm korunuyor çünkü tohum her zaman aynı yerden geliyor —
   * state'in o anki rng durumundan.
   */
  const rng: RngHolder = { rngState: startState.rngState };
  const blunder = () => nextRandom(rng) < blunderChance;

  // Support phase — at most one card, and before the play phase so a fuel or
  // free-play card can pay for the vehicles that follow it.
  if (!blunder()) {
    const support = chooseSupportToPlay(state);
    if (support) {
      const action: BattleAction = {
        type: 'PLAY_SUPPORT',
        side: BOT,
        handIndex: support.handIndex,
        targetUid: support.targetUid,
      };
      actions.push(action);
      state = applyAction(state, action);
      if (state.winner) return actions;
    }
  }

  // Play phase
  while (guard < 20) {
    guard += 1;
    const pick = blunder() ? chooseWeakCardToPlay(state.bot) : chooseCardToPlay(state.bot);
    if (pick == null) break;
    const action: BattleAction = {
      type: 'PLAY',
      side: BOT,
      handIndex: pick.handIndex,
      scrapUid: pick.scrapUid,
    };
    actions.push(action);
    state = applyAction(state, action);
    if (state.winner) return actions;
  }

  // Attack phase
  guard = 0;
  while (guard < 20) {
    guard += 1;
    if (blunder()) {
      // Half the time skip attacking entirely; otherwise swing carelessly.
      if (nextRandom(rng) < 0.5) break;
      const weak = chooseWeakAttack(state, rng);
      if (!weak) break;
      const a: BattleAction = {
        type: 'ATTACK',
        side: BOT,
        attackerUid: weak.attackerUid,
        target: weak.target,
      };
      actions.push(a);
      state = applyAction(state, a);
      if (state.winner) return actions;
      continue;
    }
    const pick = chooseAttack(state);
    if (!pick) break;
    const action: BattleAction = {
      type: 'ATTACK',
      side: BOT,
      attackerUid: pick.attackerUid,
      target: pick.target,
    };
    actions.push(action);
    state = applyAction(state, action);
    if (state.winner) return actions;
  }

  return actions;
}
