import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface PlayerStats {
  battlesPlayed: number;
  battlesWon: number;
  winStreak: number;
  bestWinStreak: number;
}

const EMPTY: PlayerStats = { battlesPlayed: 0, battlesWon: 0, winStreak: 0, bestWinStreak: 0 };

/**
 * Oyuncu istatistikleri.
 *
 * Sayaçları SADECE burası artırıyor ve yalnızca doğrulanmış bir maç sonucuyla
 * çağrılıyor (MatchService.submit). İstemciden gelen hiçbir veri buraya
 * ulaşmıyor — galibiyet sayısı bot seviyesini ve yakında ligi belirleyeceği
 * için, oyuncunun yazabildiği bir sayı olması sistemin tamamını çürütürdü.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<PlayerStats> {
    const stats = await this.prisma.userStats.findUnique({
      where: { userId },
      select: { battlesPlayed: true, battlesWon: true, winStreak: true, bestWinStreak: true },
    });
    return stats ?? EMPTY;
  }

  /**
   * Bir maçı kaydeder.
   *
   * upsert + increment: kaydı okuyup +1 yazmak yerine veritabanına artırma
   * yaptırıyoruz. İki maç aynı anda sonuçlanırsa (mümkün: iki cihaz) okuma
   * tabanlı yaklaşım birini yutardı.
   *
   * Seriyi (`winStreak`) increment ile ifade edemiyoruz çünkü kaybedince
   * sıfırlanması gerekiyor; o yüzden galibiyet ve mağlubiyet ayrı yazılıyor.
   */
  async recordBattle(userId: string, won: boolean): Promise<PlayerStats> {
    const now = new Date();
    const updated = await this.prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        battlesPlayed: 1,
        battlesWon: won ? 1 : 0,
        winStreak: won ? 1 : 0,
        bestWinStreak: won ? 1 : 0,
        lastBattleAt: now,
      },
      update: {
        battlesPlayed: { increment: 1 },
        battlesWon: won ? { increment: 1 } : undefined,
        winStreak: won ? { increment: 1 } : { set: 0 },
        lastBattleAt: now,
      },
      select: { battlesPlayed: true, battlesWon: true, winStreak: true, bestWinStreak: true },
    });

    // En iyi seri, güncel seriyi geçtiyse yükselt. Ayrı bir yazma çünkü
    // karşılaştırmalı güncelleme (`GREATEST`) Prisma'nın increment API'sinde
    // yok; iki maçın aynı anda bunu tetiklemesi zararsız (aynı sonuca varır).
    if (updated.winStreak > updated.bestWinStreak) {
      return this.prisma.userStats.update({
        where: { userId },
        data: { bestWinStreak: updated.winStreak },
        select: { battlesPlayed: true, battlesWon: true, winStreak: true, bestWinStreak: true },
      });
    }
    return updated;
  }
}
