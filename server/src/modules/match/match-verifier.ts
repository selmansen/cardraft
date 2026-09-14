import { Injectable, Logger } from '@nestjs/common';

import {
  applyAction,
  createBattle,
  type BattleAction,
  type BattleState,
  type LoadoutEntry,
} from '../../game-engine/game/battleEngine.js';
import { planBotTurn } from '../../game-engine/game/bot.js';

export interface MatchSetup {
  seed: string;
  playerLoadout: LoadoutEntry[];
  playerSupportLoadout: string[];
  botLoadout: LoadoutEntry[];
  botSupportLoadout: string[];
  botBlunderChance: number;
  botGarageHp: number;
  playerGarageHp: number;
  playerOpeningHand: number;
  botOpeningHand: number;
}

export type VerifyResult =
  | { ok: true; won: boolean; turns: number }
  | { ok: false; reason: string };

/** Oyuncunun bir turda yaptığı hamleler; tur sonu sunucu tarafından eklenir. */
export interface PlayerTurn {
  actions: Array<
    | { type: 'PLAY'; handIndex: number; scrapUid?: string }
    | { type: 'PLAY_SUPPORT'; handIndex: number; targetUid?: string }
    | { type: 'ATTACK'; attackerUid: string; target: string }
  >;
}

/** Sonsuz döngü/kötü niyetli devasa girdi koruması. */
const MAX_TURNS = 60;
const MAX_ACTIONS_PER_TURN = 30;

/**
 * Maçı sunucuda yeniden oynatıp sonucu hesaplar.
 *
 * ÇALIŞMA MANTIĞI:
 * İstemci yalnızca KENDİ hamlelerini gönderiyor. Botun ne yaptığını
 * göndermiyor — sunucu botu her turda kendisi planlıyor (motor deterministik
 * olduğu için istemcideki botla birebir aynı kararları veriyor). Böylece
 * istemci "bot hiç saldırmadı" gibi bir maç uyduramıyor.
 *
 * Ayrıca hamlelerin geçerliliği ayrıca kontrol edilmiyor: motor zaten geçersiz
 * bir hamlede state'i değiştirmiyor. Yani "elimde olmayan kartı oynadım" ya da
 * "saldıramayacak araçla saldırdım" gibi bir iddia sunucu tarafında sessizce
 * hiçbir şey yapmıyor ve maç oyuncunun umduğu gibi gitmiyor.
 *
 * SONUÇ: "kazandım" bir veri değil, sunucunun kendi hesabı.
 */
@Injectable()
export class MatchVerifier {
  private readonly logger = new Logger(MatchVerifier.name);

  verify(setup: MatchSetup, turns: PlayerTurn[]): VerifyResult {
    if (turns.length > MAX_TURNS) {
      return { ok: false, reason: `Tur sayısı sınırı aşıldı (${turns.length})` };
    }

    let state: BattleState = createBattle(setup.playerLoadout, setup.botLoadout, {
      seed: setup.seed,
      playerSupportLoadout: setup.playerSupportLoadout,
      botSupportLoadout: setup.botSupportLoadout,
      botGarageHp: setup.botGarageHp,
      playerGarageHp: setup.playerGarageHp,
      playerOpeningHand: setup.playerOpeningHand,
      botOpeningHand: setup.botOpeningHand,
    });

    for (const turn of turns) {
      if (state.winner) break;
      if (turn.actions.length > MAX_ACTIONS_PER_TURN) {
        return { ok: false, reason: 'Bir turda çok fazla hamle' };
      }
      // Sıranın gerçekten oyuncuda olduğunu doğrula: istemci fazladan tur
      // göndererek bot turunu atlatmaya çalışamasın.
      if (state.active !== 'player') {
        return { ok: false, reason: 'Sıra oyuncuda değilken hamle gönderildi' };
      }

      for (const action of turn.actions) {
        state = applyAction(state, { ...action, side: 'player' } as BattleAction);
        if (state.winner) break;
      }
      if (state.winner) break;

      state = applyAction(state, { type: 'END_TURN' });
      if (state.winner) break;

      // Bot turu — istemciden GELMİYOR, sunucu planlıyor.
      const botActions = planBotTurn(state, setup.botBlunderChance);
      for (const action of botActions) {
        state = applyAction(state, action);
        if (state.winner) break;
      }
      if (state.winner) break;
      state = applyAction(state, { type: 'END_TURN' });
    }

    if (!state.winner) {
      // Maç bitmemiş: ödül yok. İstemci yarıda bıraktığı bir maçı
      // "kazandım" diye kapatamıyor.
      return { ok: false, reason: 'Maç sonuçlanmadı' };
    }

    return { ok: true, won: state.winner === 'player', turns: state.turn };
  }
}
