import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EconomyService, type PrismaTx } from '../economy/economy.service.js';
import { AcquisitionSource, CardKind, CurrencyCode, LedgerReason } from '../../generated/prisma/enums.js';
import { cardCatalog } from './card-catalog.js';

export interface OwnedCardDto {
  cardId: string;
  kind: CardKind;
  source: AcquisitionSource;
  acquiredAt: Date;
}

export interface UnlockResult {
  card: OwnedCardDto;
  balance: { currency: CurrencyCode; balance: number };
}

/**
 * Koleksiyon: hangi kartlara sahip olunduğu ve yeni kart açma.
 *
 * Neden sunucuda: koleksiyon kadroyu, kadro da maçın kurulumunu belirliyor.
 * Cihazdaki bir listeye güvenmek, oyuncunun sahip olmadığı destansı kartlarla
 * maça çıkması demekti.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
  ) {}

  async list(userId: string): Promise<OwnedCardDto[]> {
    return this.prisma.ownedCard.findMany({
      where: { userId },
      select: { cardId: true, kind: true, source: true, acquiredAt: true },
      orderBy: { acquiredAt: 'asc' },
    });
  }

  /**
   * Yeni hesabın başlangıç kartlarını yazar.
   *
   * `createMany` + `skipDuplicates`: iki eşzamanlı çağrı (kayıt isteği ağ
   * hatasında tekrarlandı) ikinci kez yazmaya çalışmasın. Tek tek kontrol
   * etmek yarış koşuluna açık olurdu.
   */
  async grantStarters(userId: string, tx?: PrismaTx): Promise<void> {
    const client = tx ?? this.prisma;
    await client.ownedCard.createMany({
      data: cardCatalog.starters().map((c) => ({
        userId,
        cardId: c.cardId,
        kind: c.kind,
        source: AcquisitionSource.STARTER,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Kart açma: parayı düş ve kartı ver — ya ikisi birden, ya hiçbiri.
   *
   * Sıralama kasıtlı: ÖNCE kart satırı yazılıyor. Benzersizlik kısıtı
   * (userId, cardId) sahip olunan bir kartı ikinci kez almayı veritabanı
   * seviyesinde engelliyor, yani "zaten var mı" kontrolü ile ekleme arasında
   * yarış koşulu kalmıyor. Ödeme sonra geliyor; yetersiz bakiyede
   * transaction geri alınıyor ve kart satırı da yok oluyor.
   */
  async unlock(userId: string, cardId: string, currency: CurrencyCode): Promise<UnlockResult> {
    const entry = cardCatalog.find(cardId);
    if (!entry) throw new NotFoundException('Böyle bir kart yok');

    const cost = currency === CurrencyCode.COIN ? entry.price.coin : entry.price.rim;
    if (cost <= 0) {
      // Fiyatı 0 olan kart başlangıç kartıdır: satın alınamaz, zaten verilir.
      throw new BadRequestException('Bu kart satın alınamaz');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const card = await tx.ownedCard.create({
          data: {
            userId,
            cardId: entry.cardId,
            kind: entry.kind,
            source: AcquisitionSource.PURCHASE,
          },
          select: { cardId: true, kind: true, source: true, acquiredAt: true },
        });

        const balance = await this.economy.move(
          {
            userId,
            currency,
            amount: -cost,
            reason: LedgerReason.SPEND_CARD_UNLOCK,
            // Aynı kart aynı kullanıcıya bir kez satılabildiği için anahtar
            // doğal olarak benzersiz: ağ hatasında tekrarlanan istek ikinci
            // kez para düşmüyor.
            idempotencyKey: `unlock:${userId}:${entry.cardId}`,
            metadata: { cardId: entry.cardId, kind: entry.kind },
          },
          tx,
        );

        return { card, balance };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('Bu kart zaten koleksiyonunda');
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
