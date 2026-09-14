import { matchApi } from '@/api/endpoints';
import { NetworkError } from '@/api/errors';
import type { OpenMatchResponse, SubmitActionDto, SubmitMatchResponse, SubmitTurnDto } from '@/api/types';
import type { BattleAction } from '@/game/battleEngine';
import type { Difficulty } from '@/game/difficulty';
import { localMatchSetup, type MatchSetup } from '@/game/localMatchSetup';

export type { MatchSetup };

/**
 * Bir maçın sunucu tarafı: kurulumu almak, oyuncunun hamlelerini kaydetmek,
 * sonunda göndermek.
 *
 * Neden ayrı dosya: battle.tsx zaten çok büyük ve buradaki mantığın onunla
 * hiçbir görsel ilişkisi yok. Ayrıca test edilebilir kalıyor — ekran
 * açmadan bir maç kaydedilip gönderilebiliyor (e2e testi tam olarak bunu
 * yapıyor).
 */

function fromServer(res: OpenMatchResponse): MatchSetup {
  return {
    matchId: res.matchId,
    seed: res.seed,
    botLoadout: res.botLoadout,
    botSupportLoadout: res.botSupportLoadout,
    botGarageHp: res.botGarageHp,
    playerGarageHp: res.playerGarageHp,
    playerOpeningHand: res.playerOpeningHand,
    botOpeningHand: res.botOpeningHand,
    botBlunderChance: res.botBlunderChance,
  };
}

/**
 * Maç oturumu açar. Sunucuya ulaşılamazsa çevrimdışı kuruluma düşer —
 * oyun oynanabilir kalır, sadece ödülsüz.
 */
export async function openMatchSession(
  difficulty: Difficulty,
  vehicleCardIds: string[],
  supportCardIds: string[],
  battlesWon: number,
): Promise<MatchSetup> {
  try {
    const res = await matchApi.open({ difficulty, vehicleCardIds, supportCardIds });
    return fromServer(res);
  } catch (error) {
    // Ağ hatası → çevrimdışı. Başka bir hata (400/401) da oyunu
    // engellememeli; oyuncu oynayabilsin, ödül almasın.
    if (!(error instanceof NetworkError)) {
      console.warn('[match] sunucu oturumu açılamadı, çevrimdışı oynanıyor', error);
    }
    return localMatchSetup(difficulty, battlesWon);
  }
}

/**
 * Oyuncunun hamlelerini tur tur biriktirir.
 *
 * Sadece OYUNCUNUN hamleleri kaydediliyor: botunkileri sunucu kendi
 * planlıyor (aynı tohum + aynı motor = aynı bot). Bot hamlelerini de
 * göndermek hem gereksiz hem de tehlikeli olurdu — istemcinin bildirdiği bot
 * davranışına güvenmek, botu istediği gibi oynatmasına izin vermek demek.
 */
export class MatchRecorder {
  private readonly turns: SubmitTurnDto[] = [];
  private current: SubmitActionDto[] = [];

  record(action: BattleAction): void {
    if (action.type === 'END_TURN') return;
    // `side` gönderilmiyor: sunucu bu hamlelerin oyuncuya ait olduğunu zaten
    // biliyor (uç nokta kimlik doğrulamalı ve yalnızca oyuncu turları geliyor).
    const { type } = action;
    const dto: SubmitActionDto = { type };
    if ('handIndex' in action) dto.handIndex = action.handIndex;
    if ('scrapUid' in action && action.scrapUid) dto.scrapUid = action.scrapUid;
    if ('targetUid' in action && action.targetUid) dto.targetUid = action.targetUid;
    if ('attackerUid' in action) dto.attackerUid = action.attackerUid;
    if ('target' in action) dto.target = action.target;
    this.current.push(dto);
  }

  endTurn(): void {
    this.turns.push({ actions: this.current });
    this.current = [];
  }

  /**
   * Maçı sunucuya gönderir ve sunucunun kararını döndürür.
   * `null` = gönderilemedi (çevrimdışı ya da ağ hatası): ödül yok.
   */
  async submit(matchId: string | null): Promise<SubmitMatchResponse | null> {
    // Maç oyuncunun turunun ORTASINDA bitmiş olabilir (son saldırı garajı
    // düşürdü ve "Turu Bitir"e hiç basılmadı). O turun hamleleri de
    // gönderilmeli, yoksa sunucu maçı eksik oynatır ve sonuç ayrışır.
    if (this.current.length > 0) this.endTurn();
    if (!matchId) return null;
    try {
      return await matchApi.submit(matchId, this.turns);
    } catch (error) {
      console.warn('[match] sonuç gönderilemedi', error);
      return null;
    }
  }
}
