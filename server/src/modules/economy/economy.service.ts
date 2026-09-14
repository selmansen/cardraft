import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { CurrencyCode, LedgerReason } from '../../generated/prisma/enums.js';
import type { Paginated } from '../../common/dto/pagination.dto.js';

export interface LedgerMovement {
  userId: string;
  currency: CurrencyCode;
  /** Pozitif = kazanç, negatif = harcama. */
  amount: number;
  reason: LedgerReason;
  metadata?: Record<string, unknown>;
  /** Aynı anahtarla ikinci çağrı yeni kayıt YARATMAZ, mevcut sonucu döndürür. */
  idempotencyKey?: string;
}

export interface BalanceSnapshot {
  currency: CurrencyCode;
  balance: number;
}

/**
 * Cüzdan ve işlem defteri.
 *
 * TEMEL İLKE: bakiyeyi istemci söylemez, sunucu hesaplar. İstemci yalnızca
 * "şu olay oldu" der (maç bitti, kart açılmak isteniyor); ne kadar coin
 * geleceğine/gideceğine burası karar verir. Çevrimdışı oynanabilen bir oyunda
 * bu ayrım pazarlık konusu değil — cihazdaki veri her zaman düzenlenebilir.
 *
 * Para hareketlerinin tamamı TEK bir metottan (`move`) geçiyor. Ödül, harcama,
 * satın alma için ayrı ayrı yazılsaydı, transaction/idempotency/negatif bakiye
 * kontrolü üç yerde tekrarlanır ve biri eksik kalırdı — eksik kalanın bedeli
 * de gerçek para oluyor.
 */
/**
 * `$transaction` içindeki Prisma istemcisi.
 *
 * Prisma'nın kendi ürettiği tip kullanılıyor, elle `Omit<...>` yazılmıyor:
 * hangi metotların transaction içinde YASAK olduğunu (`$connect`,
 * `$transaction`, …) Prisma belirliyor ve bu liste sürümle değişebiliyor.
 */
export type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class EconomyService {
  private readonly logger = new Logger(EconomyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tek para hareketi. Atomik: bakiye güncellemesi ve defter kaydı ya birlikte
   * olur ya hiç olmaz.
   *
   * @param outer Varsa, hareket ÇAĞIRANIN transaction'ına katılır.
   *   Bu olmadan "parayı düş, sonra kartı ver" iki ayrı transaction olurdu ve
   *   arada bir hata oluşursa oyuncu parasını kaybedip kartı alamazdı. Kendi
   *   transaction'ını açmakta ısrar eden bir servis, çağıranın bütünlüğünü
   *   garanti edemez — o yüzden karar çağırana bırakılıyor.
   */
  async move(movement: LedgerMovement, outer?: PrismaTx): Promise<BalanceSnapshot> {
    if (!Number.isInteger(movement.amount) || movement.amount === 0) {
      throw new BadRequestException('Tutar sıfırdan farklı bir tam sayı olmalı');
    }

    // Tekrar eden istek: aynı anahtarla daha önce işlendiyse yeniden işleme,
    // o zamanki sonucu döndür. İstemci ağ hatasında güvenle tekrar deneyebilsin.
    if (movement.idempotencyKey) {
      const previous = await (outer ?? this.prisma).ledgerEntry.findUnique({
        where: { idempotencyKey: movement.idempotencyKey },
        select: { balanceAfter: true, wallet: { select: { currency: true } } },
      });
      if (previous) {
        return { currency: previous.wallet.currency, balance: previous.balanceAfter };
      }
    }

    try {
      return outer
        ? await this.applyMovement(outer, movement)
        : await this.prisma.$transaction((tx) => this.applyMovement(tx, movement));
    } catch (error) {
      // Benzersizlik ihlali = iki eşzamanlı istek aynı idempotency anahtarıyla
      // geldi ve yarışı diğeri kazandı. Hata değil, beklenen durum: kazananın
      // sonucunu okuyup döndürüyoruz.
      if (movement.idempotencyKey && this.isUniqueViolation(error)) {
        const winner = await this.prisma.ledgerEntry.findUnique({
          where: { idempotencyKey: movement.idempotencyKey },
          select: { balanceAfter: true, wallet: { select: { currency: true } } },
        });
        if (winner) {
          return { currency: winner.wallet.currency, balance: winner.balanceAfter };
        }
      }
      throw error;
    }
  }


  /** `move`'un gerçek işi — verilen istemci üzerinde, kendi transaction'ını AÇMADAN. */
  private async applyMovement(tx: PrismaTx, movement: LedgerMovement): Promise<BalanceSnapshot> {
      // Cüzdan yoksa yarat. `upsert` kullanmıyoruz çünkü aşağıdaki
      // güncellemeyi zaten atomik yapacağız; burada sadece varlığını
      // garantiliyoruz.
      const wallet = await tx.wallet.upsert({
        where: { userId_currency: { userId: movement.userId, currency: movement.currency } },
        create: { userId: movement.userId, currency: movement.currency, balance: 0 },
        update: {},
        select: { id: true, balance: true },
      });

      /**
       * EŞZAMANLILIK — buranın kritik olma sebebi:
       *
       * "Bakiyeyi oku (100), kontrol et (>=50), yaz (50)" sırası iki istek
       * aynı anda geldiğinde bozulur: ikisi de 100 okur, ikisi de yeterli
       * bulur, ikisi de 50 yazar — kullanıcı 100 coin'lik bakiyeyle 100
       * coin'lik iki alışveriş yapmış olur.
       *
       * Bunun yerine kontrol ve güncelleme TEK bir atomik ifadede:
       * `updateMany` koşulu (`balance >= tutar`) veritabanının satır
       * kilidiyle değerlendiriliyor. İkinci istek koşulu sağlayamayınca
       * count 0 dönüyor ve reddediliyor.
       */
      const debit = movement.amount < 0;
      const updated = await tx.wallet.updateMany({
        where: debit
          ? { id: wallet.id, balance: { gte: Math.abs(movement.amount) } }
          : { id: wallet.id },
        data: { balance: { increment: movement.amount } },
      });

      if (updated.count === 0) {
        throw new BadRequestException('Yetersiz bakiye');
      }

      const fresh = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: { balance: true, currency: true },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          amount: movement.amount,
          balanceAfter: fresh.balance,
          reason: movement.reason,
          metadata: (movement.metadata ?? undefined) as never,
          idempotencyKey: movement.idempotencyKey ?? null,
        },
      });

      return { currency: fresh.currency, balance: fresh.balance };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  /** Kullanıcının tüm bakiyeleri. Cüzdanı olmayan para birimi 0 sayılır. */
  async balances(userId: string): Promise<BalanceSnapshot[]> {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: { currency: true, balance: true },
    });
    const found = new Map(wallets.map((w) => [w.currency, w.balance]));
    return Object.values(CurrencyCode).map((currency) => ({
      currency,
      balance: found.get(currency) ?? 0,
    }));
  }

  /** İşlem geçmişi — "coinim nereye gitti" sorusunun kullanıcıya cevabı. */
  async history(
    userId: string,
    currency: CurrencyCode,
    page: number,
    limit: number,
  ): Promise<Paginated<{ amount: number; balanceAfter: number; reason: string; createdAt: Date }>> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
      select: { id: true },
    });
    if (!wallet) return { items: [], total: 0, page, limit };

    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { amount: true, balanceAfter: true, reason: true, createdAt: true },
      }),
      this.prisma.ledgerEntry.count({ where: { walletId: wallet.id } }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Bütünlük kontrolü: bakiye, defterdeki hareketlerin toplamına eşit mi?
   *
   * Normalde eşit olmalı (ikisi aynı transaction'da yazılıyor). Eşit
   * değilse ya bir hata var ya da veritabanına dışarıdan müdahale edilmiş —
   * ikisi de bilinmesi gereken şeyler. İleride zamanlanmış bir işle
   * (kuyruk üzerinden) düzenli çalıştırılacak.
   */
  async audit(userId: string, currency: CurrencyCode): Promise<{ ok: boolean; balance: number; ledgerSum: number }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
      select: { id: true, balance: true },
    });
    if (!wallet) return { ok: true, balance: 0, ledgerSum: 0 };

    const sum = await this.prisma.ledgerEntry.aggregate({
      where: { walletId: wallet.id },
      _sum: { amount: true },
    });
    const ledgerSum = sum._sum.amount ?? 0;
    const ok = ledgerSum === wallet.balance;
    if (!ok) {
      this.logger.error(
        `Cüzdan tutarsız! user=${userId} ${currency}: bakiye=${wallet.balance} defter=${ledgerSum}`,
      );
    }
    return { ok, balance: wallet.balance, ledgerSum };
  }
}
