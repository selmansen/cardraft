import { BadRequestException, Injectable } from '@nestjs/common';

import { validateLoadout } from '../../game-engine/game/loadoutRules.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';

export interface LoadoutDto {
  vehicleCardIds: string[];
  supportCardIds: string[];
  /** Hiç kadro kaydedilmemişse false — istemci o zaman yereldekini yükleyip yazıyor. */
  saved: boolean;
}

/**
 * Kayıtlı kadro.
 *
 * Maç açılışındaki doğrulamanın AYNISI burada da yapılıyor (biçim + sahiplik)
 * ve bu tekrar bilinçli değil, zorunlu: iki uç birbirinden bağımsız çağrılıyor.
 * Kadroyu kaydetmek maç açmıyor, maç açmak da kayıtlı kadroyu okumuyor —
 * istemci maça hangi kartlarla çıktığını hâlâ kendi gönderiyor. Kaydetmede
 * doğrulama atlanırsa sahip olunmayan kartlardan oluşan bir kadro veritabanına
 * yazılır ve oyuncu her açılışta "kadron bozuk" durumuna düşer.
 */
@Injectable()
export class LoadoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async get(userId: string): Promise<LoadoutDto> {
    const row = await this.prisma.loadout.findUnique({
      where: { userId },
      select: { vehicleCardIds: true, supportCardIds: true },
    });
    if (!row) return { vehicleCardIds: [], supportCardIds: [], saved: false };
    return { ...row, saved: true };
  }

  /**
   * Kadroyu yazar. Son yazan kazanır: kadro ekranı düzenleme sırasında
   * art arda yazıyor ve iki cihazdan aynı anda düzenleme gerçekçi bir senaryo
   * değil — sürüm çakışması yönetmek buraya ağır gelirdi.
   */
  async save(userId: string, vehicleCardIds: string[], supportCardIds: string[]): Promise<LoadoutDto> {
    // Biçim: en az 3 araç, en fazla 5 destek, toplam 8. Kural motordan
    // geliyor, yani arayüzün dayattığı kuralla reddetme sebebi aynı cümle.
    const invalid = validateLoadout(vehicleCardIds, supportCardIds);
    if (invalid) throw new BadRequestException(invalid);

    // Tekrar eden kart kontrolü BURADA YOK: validateLoadout onu da yapıyor
    // (ve daha iyi bir mesajla — hangi kartın tekrar ettiğini söylüyor).
    const ids = [...vehicleCardIds, ...supportCardIds];
    const owned = new Set((await this.inventory.list(userId)).map((c) => c.cardId));
    const missing = ids.filter((id) => !owned.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Sahip olmadığın kart(lar): ${missing.join(', ')}`);
    }

    const row = await this.prisma.loadout.upsert({
      where: { userId },
      create: { userId, vehicleCardIds, supportCardIds },
      update: { vehicleCardIds, supportCardIds },
      select: { vehicleCardIds: true, supportCardIds: true },
    });
    return { ...row, saved: true };
  }
}
