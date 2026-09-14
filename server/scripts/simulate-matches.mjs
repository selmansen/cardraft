#!/usr/bin/env node
/**
 * Denge ölçümü: N maçı baştan sona oynatır ve kazanma oranlarını raporlar.
 *
 * Neden var: zorluk ayarları ve bot ölçeklemesi tahminle yazılmıştı. Bir
 * sayıyı değiştirip "daha zor hissettiriyor" demek ölçüm değil; bu script
 * "normal zorlukta oyuncu kaç maçta bir kazanıyor" sorusuna rakam veriyor.
 * Ekonomi hesapları (ADR 0009: ~28 maçta bir destansı kart) doğrudan bu orana
 * dayandığı için, oran bilinmeden fiyat da bilinemiyor.
 *
 * Nasıl çalışıyor: iki tarafı da AYNI yapay zekâ (`planBotTurn`) oynatıyor.
 * Planlayıcı yalnızca `state.bot` tarafını planladığı için oyuncu sırasında
 * state aynalanıyor (player <-> bot, `active` dahil) ve dönen hamlelerin
 * tarafı geri çevriliyor. Böylece ölçülen şey oyunculuk farkı değil, kurulum
 * farkı: deste, garaj canı, açılış eli, hata oranı.
 *
 * Kullanım:
 *   npm run simulate                # oyuncu koleksiyonundan rastgele kadro kurar
 *   npm run simulate -- --curated   # iki taraf da küratörlü deste (saf zorluk etkisi)
 *   npm run simulate -- --n 1000    # hücre başına maç sayısı
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const ENGINE = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'game-engine');
const load = (p) => import(pathToFileURL(join(ENGINE, p)).href);

const { createBattle, applyAction } = await load('game/battleEngine.js');
const { planBotTurn } = await load('game/bot.js');
const { makeBotLoadout, makeBotSupportLoadout } = await load('game/botDeck.js');
const { DIFFICULTY } = await load('game/difficulty.js');
const { CARDS, STARTER_CARD_IDS } = await load('data/cards.js');
const { SUPPORT_CARDS, STARTER_SUPPORT_IDS } = await load('data/supportCards.js');

const args = process.argv.slice(2);
const CURATED = args.includes('--curated');
const N = Number(args[args.indexOf('--n') + 1]) || 300;

const RARITY = { common: 0, rare: 1, epic: 2, legendary: 3 };
/** botDeck.ts'teki merdivenin aynısı — oyuncunun neyi açmış olabileceği için. */
const tier = (w) => (w >= 25 ? 3 : w >= 10 ? 2 : w >= 3 ? 1 : 0);

/**
 * O kademedeki bir oyuncunun kadrosu.
 *
 * Varsayılan: sahip olabileceği kartlardan rastgele 5 araç + 3 pit — yani
 * desteyi özenle kurmayan bir oyuncu. `--curated` ile botun küratörlü
 * destelerinden biri; o zaman iki taraf birebir eşitlenir ve geriye yalnızca
 * zorluk ayarlarının etkisi kalır.
 */
function playerLoadout(wins, rnd) {
  if (CURATED) {
    return { vehicles: makeBotLoadout(wins), support: makeBotSupportLoadout(undefined, wins) };
  }
  const cap = tier(wins);
  const owned = CARDS.filter((c) => STARTER_CARD_IDS.includes(c.id) || RARITY[c.rarity] <= cap);
  const sup = SUPPORT_CARDS.filter((c) => STARTER_SUPPORT_IDS.includes(c.id) || c.power <= cap + 1);
  return {
    vehicles: [...owned].sort(() => rnd() - 0.5).slice(0, 5).map((c) => ({ cardId: c.id })),
    support: [...sup].sort(() => rnd() - 0.5).slice(0, 3).map((c) => c.id),
  };
}

function playMatch(difficulty, wins, rnd) {
  const preset = DIFFICULTY[difficulty];
  const { vehicles, support } = playerLoadout(wins, rnd);
  let state = createBattle(vehicles, makeBotLoadout(wins), {
    botGarageHp: preset.botGarageHp,
    playerGarageHp: preset.playerGarageHp,
    playerOpeningHand: preset.playerOpeningHand,
    botOpeningHand: preset.botOpeningHand,
    playerSupportLoadout: support,
    botSupportLoadout: makeBotSupportLoadout(undefined, wins),
  });

  let guard = 0;
  while (!state.winner && guard++ < 300) {
    const side = state.active;
    // Aynalama: planlayıcı yalnızca state.bot'u planlıyor. `active` de
    // çevrilmeli, yoksa playCard/attack "sıra sende değil" diye hiçbir şey
    // yapmaz ve planlayıcı donmuş bir state üzerinde plan üretir.
    const view =
      side === 'bot' ? state : { ...state, player: state.bot, bot: state.player, active: 'bot' };
    // Hata oranı yalnızca bota: oyuncu kasten kötü oynamaz.
    const blunder = side === 'bot' ? preset.botBlunderChance : 0;
    for (const action of planBotTurn(view, blunder)) {
      state = applyAction(state, { ...action, side });
      if (state.winner) break;
    }
    if (state.winner) break;
    state = applyAction(state, { type: 'END_TURN', side });
  }

  return {
    won: state.winner === 'player',
    draw: !state.winner,
    turns: state.turn,
    fatiguePlayer: state.player.fatigue,
    fatigueBot: state.bot.fatigue,
  };
}

// Sabit tohumlu basit rastgelelik: iki koşu karşılaştırılabilir olsun.
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

console.log(
  `\n${N} maç/hücre · ${CURATED ? 'iki taraf da küratörlü deste' : 'oyuncu rastgele kadro kuruyor'}\n`,
);
console.log('zorluk   galibiyet | oyuncu kazanma | ort. tur | yorgunluk (oyuncu/bot)');
console.log('─'.repeat(70));

for (const difficulty of ['easy', 'normal', 'hard']) {
  for (const wins of [0, 5, 15, 30]) {
    let won = 0, turns = 0, fp = 0, fb = 0, draws = 0;
    for (let i = 0; i < N; i++) {
      const r = playMatch(difficulty, wins, rnd);
      if (r.draw) { draws++; continue; }
      if (r.won) won++;
      turns += r.turns;
      if (r.fatiguePlayer > 0) fp++;
      if (r.fatigueBot > 0) fb++;
    }
    const played = N - draws || 1;
    console.log(
      difficulty.padEnd(8),
      String(wins).padStart(9), '|',
      `${((won / played) * 100).toFixed(1)}%`.padStart(13), '|',
      (turns / played).toFixed(1).padStart(8), '|',
      `${((fp / played) * 100).toFixed(0)}% / ${((fb / played) * 100).toFixed(0)}%`.padStart(12),
      draws ? `(${draws} berabere)` : '',
    );
  }
}
console.log(
  '\nADR 0009 ekonomi hesabı normal zorlukta ~%65 kazanma varsayıyor;' +
    '\nbu oran değişirse kart fiyatlarının temposu da değişir.\n',
);
