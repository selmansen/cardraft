import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import { TypedConfigService } from '../../config/app-config.module.js';
import { CurrencyCode, LedgerReason } from '../../generated/prisma/enums.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { EconomyService, type BalanceSnapshot } from '../economy/economy.service.js';

export class DevGrantDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  rim?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  coin?: number;
}

/**
 * GEÇİCİ — GELİŞTİRME ARACI. Silinmek üzere yazıldı.
 *
 * Apple/Google istemci kimlikleri ve geliştirme derlemesi henüz yok; test
 * cihazında hesap açıp paket/kart akışlarını denemenin başka yolu yok. Bu uç
 * yalnızca cüzdana bakiye yazıyor — kart vermiyor, hesap yükseltmiyor: o
 * işleri gerçek uçlar yapsın ki denenen şey gerçek akış olsun.
 *
 * ÜRETİME SIZMASI İÇİN İKİ KİLİT VAR:
 *   1. DevModule.register() üretimde denetleyiciyi hiç kaydetmiyor.
 *   2. Yine de kaydolursa buradaki kontrol her isteği reddediyor.
 * Biri unutulursa diğeri tutuyor — tek kilide güvenmek, "para basma ucu
 * açık kaldı" hatasının bedelini göze almak olurdu.
 *
 * Swagger'dan gizli: üretimde var olmayan bir uç belgelenirse, belge yalan
 * söyler.
 */
@ApiExcludeController()
@ApiBearerAuth('access-token')
@Controller('dev')
export class DevController {
  constructor(
    private readonly economy: EconomyService,
    private readonly config: TypedConfigService,
  ) {}

  /** Oturumdaki kullanıcının cüzdanına bakiye yazar. */
  @Post('grant')
  async grant(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: DevGrantDto,
  ): Promise<BalanceSnapshot[]> {
    if (this.config.isProduction) {
      throw new ForbiddenException('Geliştirme aracı');
    }

    const moves: Promise<BalanceSnapshot>[] = [];
    if (body.rim) {
      moves.push(
        this.economy.move({
          userId: user.sub,
          currency: CurrencyCode.RIM,
          amount: body.rim,
          reason: LedgerReason.ADMIN_ADJUSTMENT,
          metadata: { source: 'dev-grant' },
        }),
      );
    }
    if (body.coin) {
      moves.push(
        this.economy.move({
          userId: user.sub,
          currency: CurrencyCode.COIN,
          amount: body.coin,
          reason: LedgerReason.ADMIN_ADJUSTMENT,
          metadata: { source: 'dev-grant' },
        }),
      );
    }
    // idempotencyKey YOK: amaç tam olarak "bir daha bas". Defter kaydı yine
    // düşüyor, yani bakiye = defter toplamı denetimi bozulmuyor.
    return Promise.all(moves);
  }
}
