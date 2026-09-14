import { randomInt } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { duplicateRefund, getPack, PACKS, packPool, rarityForRoll } from '../../game-engine/game/packs.js';
import type { Rarity } from '../../game-engine/types/index.js';
import { AcquisitionSource, CurrencyCode, LedgerReason } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EconomyService } from '../economy/economy.service.js';
import { cardCatalog } from '../inventory/card-catalog.js';

export interface PackOpenResult {
  packId: string;
  card: { cardId: string; name: string; rarity: string };
  /** Kart zaten koleksiyonda mıydı? */
  duplicate: boolean;
  /** Harcanan jant. */
  spent: number;
  /** Tekrar kart çıktıysa geri verilen jant, yoksa 0. */
  refund: number;
  balance: { currency: CurrencyCode; balance: number };
}

/**
 * Mağaza: paket açma.
 *
 * Çekiliş SUNUCUDA, ve bu pazarlık konusu değil. İstemci çekseydi kazanan
 * sonucu bulana kadar deneyip onu gönderebilirdi; oranları yayınlamanın da
 * bir anlamı kalmazdı.
 *
 * Oranlar ve fiyatlar burada YAZILI DEĞİL — paylaşılan motordan
 * (`game/packs.ts`) okunuyor. Mağaza ekranı da aynı dosyadan okuyor, yani
 * oyuncuya gösterilen oranla çekilişte kullanılan oran aynı olmak zorunda.
 */
@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
  ) {}

  /** Mağazadaki paketler — fiyatları ve oranlarıyla. */
  listPacks() {
    return PACKS.map((pack) => ({
      id: pack.id,
      name: pack.name,
      blurb: pack.blurb,
      price: pack.price,
      odds: pack.odds,
    }));
  }

  /**
   * Paket açar: parayı düş, kartı çek, ya ver ya iade et — hepsi tek
   * transaction içinde.
   *
   * Sıralama önemli: önce ödeme. Bakiye yetmiyorsa hiç çekiliş yapılmıyor,
   * yani oyuncu "ne çıkacaktı" bilgisini bedava öğrenemiyor.
   */
  async openPack(userId: string, packId: string, requestId: string): Promise<PackOpenResult> {
    const pack = getPack(packId);
    if (!pack) throw new NotFoundException('Böyle bir paket yok');
    if (pack.price.rim <= 0) throw new BadRequestException('Bu paket satın alınamaz');

    // Tekrar gönderim: ilk açılışın sonucu aynen döner, yeni çekiliş yok.
    const existing = await this.prisma.packOpening.findUnique({
      where: { userId_requestId: { userId, requestId } },
    });
    if (existing) return this.toResult(existing, await this.rimBalance(userId));

    return this.prisma.$transaction(async (tx) => {
      const afterSpend = await this.economy.move(
        {
          userId,
          currency: CurrencyCode.RIM,
          amount: -pack.price.rim,
          reason: LedgerReason.PACK_OPEN,
          idempotencyKey: `pack:${userId}:${requestId}`,
          metadata: { packId: pack.id },
        },
        tx,
      );

      const rarity = this.rollRarity(pack.odds);
      const cardId = this.pickCard(rarity);
      const entry = cardCatalog.find(cardId);
      // packPool katalogdan geliyor, yani buraya düşmesi imkânsız; yine de
      // sessizce yanlış kart vermektense patlamak doğru.
      if (!entry) throw new Error(`Havuzdaki kart katalogda yok: ${cardId}`);

      const owned = await tx.ownedCard.findUnique({
        where: { userId_cardId: { userId, cardId } },
        select: { id: true },
      });

      let refund = 0;
      let balance = afterSpend;

      if (owned) {
        refund = duplicateRefund(entry.price.rim);
        if (refund > 0) {
          balance = await this.economy.move(
            {
              userId,
              currency: CurrencyCode.RIM,
              amount: refund,
              reason: LedgerReason.PACK_DUPLICATE_REFUND,
              idempotencyKey: `pack-refund:${userId}:${requestId}`,
              metadata: { packId: pack.id, cardId },
            },
            tx,
          );
        }
      } else {
        await tx.ownedCard.create({
          data: { userId, cardId, kind: entry.kind, source: AcquisitionSource.PACK },
        });
      }

      const opening = await tx.packOpening.create({
        data: {
          userId,
          packId: pack.id,
          cardId,
          rarity,
          duplicate: Boolean(owned),
          spent: pack.price.rim,
          refund,
          requestId,
        },
      });

      return this.toResult(opening, balance.balance);
    });
  }

  /**
   * Nadirlik çekilişi — kriptografik rastgelelik.
   *
   * `Math.random` yeterli görünüyor ama burada para söz konusu: öngörülebilir
   * bir üreteç, sırayı bilen birinin destansı kartın ne zaman geleceğini
   * hesaplamasına izin verir. `randomInt` tarafsız bir aralık da garanti
   * ediyor (modulo sapması yok). Aralık→nadirlik eşlemesi oranların yanında
   * duruyor (`rarityForRoll`), rastgeleliğin kalitesi ise burada.
   */
  private rollRarity(odds: Partial<Record<Rarity, number>>): Rarity {
    return rarityForRoll(odds, randomInt(0, 100));
  }

  private pickCard(rarity: Rarity): string {
    const pool = packPool(rarity);
    return pool[randomInt(0, pool.length)];
  }

  private async rimBalance(userId: string): Promise<number> {
    const balances = await this.economy.balances(userId);
    return balances.find((b) => b.currency === CurrencyCode.RIM)?.balance ?? 0;
  }

  private toResult(
    opening: { packId: string; cardId: string; rarity: string; duplicate: boolean; spent: number; refund: number },
    balance: number,
  ): PackOpenResult {
    const entry = cardCatalog.find(opening.cardId);
    return {
      packId: opening.packId,
      card: {
        cardId: opening.cardId,
        name: entry?.name ?? opening.cardId,
        rarity: opening.rarity,
      },
      duplicate: opening.duplicate,
      spent: opening.spent,
      refund: opening.refund,
      balance: { currency: CurrencyCode.RIM, balance },
    };
  }
}
