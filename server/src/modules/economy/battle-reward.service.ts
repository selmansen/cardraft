import { Injectable } from '@nestjs/common';

import type { Difficulty } from '../../game-engine/game/difficulty.js';
import { EconomyService, type BalanceSnapshot } from './economy.service.js';
import { battleReward } from './reward.rules.js';

/**
 * Maç ödülünün verilmesi.
 *
 * Ayrı bir servis çünkü sorumluluğu farklı: `EconomyService` "para nasıl
 * hareket eder"i bilir, burası "bu maç ne kadar ettirdi"yi.
 *
 * NOT — burada hız sınırı YOK, bilerek. Bir süre saatlik tavan vardı ama o
 * bir "hasarı sınırlama" önlemiydi: uydurma maç bildirimini yavaşlatıyor,
 * engellemiyordu. Yerine gerçek çözüm geldi — maç sunucuda doğrulanıyor
 * (MatchService), yani ödül ancak sunucunun kendi hesapladığı sonuca göre
 * veriliyor. Doğrulanmış bir sonuca tavan koymak, meşru oyuncuyu
 * cezalandırmaktan başka bir işe yaramazdı.
 */
@Injectable()
export class BattleRewardService {
  constructor(private readonly economy: EconomyService) {}

  /**
   * @param matchId Sunucunun açtığı maç oturumunun kimliği; idempotency
   *   anahtarı olarak da kullanılıyor, aynı maç iki kez ödüllendirilemiyor.
   * @param difficulty Maç AÇILIRKEN kaydedilen zorluk — istemcinin bitişte
   *   gönderdiği değer değil, yoksa kolay oynayıp zor ödülü istenebilirdi.
   */
  async grant(
    userId: string,
    matchId: string,
    won: boolean,
    difficulty: Difficulty,
  ): Promise<BalanceSnapshot> {
    const outcome = battleReward(won, difficulty);
    return this.economy.move({
      userId,
      currency: outcome.currency,
      amount: outcome.amount,
      reason: outcome.reason,
      idempotencyKey: `match:${matchId}`,
      metadata: { matchId, won },
    });
  }
}
