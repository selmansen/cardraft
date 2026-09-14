import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { LoadoutEntry } from '../../game-engine/game/battleEngine.js';
import { MatchStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { BattleRewardService } from '../economy/battle-reward.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { StatsService } from '../stats/stats.service.js';
import type { OpenMatchDto, SubmitMatchDto } from './dto/match.dto.js';
import { MatchVerifier, type MatchSetup, type PlayerTurn } from './match-verifier.js';
import { DIFFICULTY, type Difficulty } from '../../game-engine/game/difficulty.js';
import { makeBotLoadout, makeBotSupportLoadout } from '../../game-engine/game/botDeck.js';
import { validateLoadout } from '../../game-engine/game/loadoutRules.js';

/**
 * Zorluk ayarları ve bot desteleri artık istemciyle AYNI dosyadan geliyor
 * (sync:engine ile kopyalanan motor). Bir süre burada elle yazılmış kopyaları
 * durdu; ilk gerçek denemede uydurma bir kart kimliği yüzünden maç kurulumu
 * patladı. İstemci hangi zorluğu SEÇTİĞİNİ söyleyebilir ama o zorluğun ne
 * anlama geldiğine (bot canı, hata oranı) hâlâ sunucu karar veriyor.
 */


@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifier: MatchVerifier,
    private readonly rewards: BattleRewardService,
    private readonly stats: StatsService,
    private readonly inventory: InventoryService,
  ) {}


  /**
   * Maç oturumu açar: tohumu ve bot kurulumunu SUNUCU belirler.
   *
   * Tohumun sunucudan gelmesi kritik: istemci kendi tohumunu seçebilseydi,
   * kazandığı bir tohum bulana kadar deneyip onu oynayabilirdi (grinding).
   */
  async open(userId: string, dto: OpenMatchDto) {
    const preset = DIFFICULTY[dto.difficulty as Difficulty];
    const seed = randomUUID();

    /**
     * Botun gücü oyuncunun galibiyet sayısına göre ölçekleniyor ve o sayı
     * SUNUCUDAN okunuyor — istemciden gelseydi, oyuncu "0 galibiyetim var"
     * deyip hep en zayıf botla oynardı. Sayaç zaten sadece doğrulanmış maç
     * sonucuyla artıyor (StatsService), yani buradaki değer güvenilir.
     *
     * Parametre bir süre hiç geçilmiyordu: `makeBotLoadout()` varsayılan 0
     * ile çalışıyor ve ölçekleme sessizce devre dışı kalıyordu — bot her
     * zaman en düşük kademede oynuyordu.
     */
    const { battlesWon } = await this.stats.get(userId);
    const botLoadout: LoadoutEntry[] = makeBotLoadout(battlesWon);
    const botSupportLoadout = makeBotSupportLoadout(3, battlesWon);

    /**
     * Kadroyu istemci SEÇİYOR ama sunucu DOĞRULUYOR.
     *
     * İkisi farklı şeyler: hangi kartlarla oynayacağı oyuncunun tercihi,
     * o kartlara sahip olup olmadığı ise bir gerçek. Sahiplik kontrolü
     * olmadan istemci "vipera-gt, singularity, apex-meridian" deyip hiç
     * açmadığı destansı kartlarla maça çıkabilirdi.
     *
     * Kadro ayrıca DONDURULUP saklanıyor: doğrulama maç açılırkenki kadroyla
     * yapılmak zorunda, oyuncu maç ortasında kadrosunu değiştiremesin.
     */
    /**
     * Kadronun BİÇİMİ de doğrulanıyor, sadece sahiplik değil.
     *
     * DTO yalnızca her dizinin en fazla 8 olmasını kontrol ediyordu; toplamı
     * kontrol eden bir şey yoktu. Yani değiştirilmiş bir istemci 8 araç +
     * 8 destek gönderip 32 kartlık desteyle oynayabilirdi — deste, kadronun
     * iki katı ve deste bitince yorgunluk hasarı başlıyor, dolayısıyla bu
     * uzun maçlarda neredeyse garanti galibiyet demekti.
     *
     * Kural motordan geliyor (`loadoutRules.ts`), yani arayüzün dayattığı
     * kuralla sunucunun reddetme sebebi aynı cümle.
     */
    const invalid = validateLoadout(dto.vehicleCardIds, dto.supportCardIds);
    if (invalid) {
      throw new BadRequestException(invalid);
    }

    const owned = new Set((await this.inventory.list(userId)).map((c) => c.cardId));
    const missing = [...dto.vehicleCardIds, ...dto.supportCardIds].filter((id) => !owned.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Sahip olmadığın kart(lar): ${missing.join(', ')}`);
    }

    const playerLoadout: LoadoutEntry[] = dto.vehicleCardIds.map((cardId) => ({ cardId }));

    const match = await this.prisma.matchSession.create({
      data: {
        userId,
        seed,
        difficulty: dto.difficulty,
        // Prisma'nın Json tipi dizileri doğrudan kabul etmiyor; içerik zaten
        // düz veri olduğu için dönüşüm güvenli.
        playerLoadout: playerLoadout as unknown as object[],
        playerSupportLoadout: dto.supportCardIds,
        botLoadout: botLoadout as unknown as object[],
        botSupportLoadout,
      },
      select: { id: true, seed: true, createdAt: true },
    });

    return {
      matchId: match.id,
      seed: match.seed,
      // İstemci maçı bu kurulumla oynayacak; birebir aynısıyla doğrulanacak.
      botLoadout,
      botSupportLoadout,
      ...preset,
    };
  }

  /**
   * Hamleleri alır, maçı sunucuda yeniden oynatır, sonucu belirler ve
   * kazanıldıysa ödülü yazar.
   */
  async submit(userId: string, matchId: string, dto: SubmitMatchDto) {
    const match = await this.prisma.matchSession.findFirst({
      // userId koşulu: başkasının maçını sonuçlandırmak mümkün olmasın.
      where: { id: matchId, userId },
    });
    if (!match) throw new NotFoundException('Maç bulunamadı');

    if (match.status !== MatchStatus.OPEN) {
      // Zaten sonuçlanmış: tekrar göndermek ödülü ikiye katlamamalı.
      // (Ödül tarafında ayrıca idempotency var; bu erken ve net cevap.)
      throw new BadRequestException('Bu maç zaten sonuçlandı');
    }

    const preset = DIFFICULTY[match.difficulty as Difficulty];
    const setup: MatchSetup = {
      seed: match.seed,
      playerLoadout: match.playerLoadout as unknown as LoadoutEntry[],
      playerSupportLoadout: match.playerSupportLoadout as unknown as string[],
      botLoadout: match.botLoadout as unknown as LoadoutEntry[],
      botSupportLoadout: match.botSupportLoadout as unknown as string[],
      ...preset,
    };

    const result = this.verifier.verify(setup, dto.turns as unknown as PlayerTurn[]);
    const actionCount = dto.turns.reduce((n, t) => n + t.actions.length, 0);

    if (!result.ok) {
      await this.prisma.matchSession.update({
        where: { id: match.id },
        data: {
          status: MatchStatus.REJECTED,
          rejectReason: result.reason,
          actionCount,
          settledAt: new Date(),
        },
      });
      this.logger.warn(`Maç reddedildi user=${userId} match=${match.id}: ${result.reason}`);
      throw new BadRequestException(`Maç doğrulanamadı: ${result.reason}`);
    }

    await this.prisma.matchSession.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.SETTLED,
        won: result.won,
        turns: result.turns,
        actionCount,
        settledAt: new Date(),
      },
    });

    // İkisi de SUNUCUNUN hesapladığı sonuca göre: önce istatistik (bir sonraki
    // maçın bot seviyesini bu belirleyecek), sonra ödül.
    const stats = await this.stats.recordBattle(userId, result.won);
    const { amount: reward, balance } = await this.rewards.grant(
      userId,
      match.id,
      result.won,
      match.difficulty as Difficulty,
    );
    /**
     * `reward` yanıtta: istemci ödülü KENDİ hesaplamasın.
     *
     * Eskiden ekran `battleReward(won, difficulty)` çağırıp gösterdiği sayıyı
     * kendi üretiyordu. Bugün aynı sonucu veriyor (kural paylaşılan motorda)
     * ama sunucu ileride bir çarpan ya da bonus eklediğinde ekran sessizce
     * yanlış rakam gösterirdi — oyuncunun gördüğü sayı ile bakiyesine yazılan
     * sayı farklı olurdu.
     */
    return { won: result.won, turns: result.turns, reward, balance, stats };
  }
}
