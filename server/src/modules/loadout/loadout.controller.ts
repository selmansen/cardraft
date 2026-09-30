import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AccountRequired } from '../../common/decorators/account-required.decorator.js';
import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { SaveLoadoutDto } from './dto/loadout.dto.js';
import { LoadoutService, type LoadoutDto } from './loadout.service.js';

@ApiTags('Kadro')
@ApiBearerAuth('access-token')
@Controller('loadout')
export class LoadoutController {
  constructor(private readonly loadout: LoadoutService) {}

  /**
   * Kayıtlı kadro. Hiç kaydedilmemişse boş dizilerle `saved: false` döner —
   * istemci o durumda cihazdaki kadroyu yükleyip buraya yazıyor, yani mevcut
   * oyuncular kadrolarını kaybetmiyor.
   *
   * Misafirde de okunabilir (@AccountRequired YOK): boş cevap dönüyor ve
   * misafirin kadro ekranı yerel kadroyla çalışmaya devam ediyor.
   */
  @Get()
  get(@CurrentUser() user: AccessTokenPayload): Promise<LoadoutDto> {
    return this.loadout.get(user.sub);
  }

  /**
   * Kadroyu kaydeder. Biçim ve sahiplik sunucuda doğrulanıyor.
   *
   * Hesap şart: misafirin kadrosu cihazda kalıyor. Misafir zaten hiçbir şey
   * biriktiremiyor (ADR 0016) ve kaydetmenin amacı cihaz değiştirince
   * kaybetmemek — kaydedilecek bir hesap yoksa yazmanın da anlamı yok.
   */
  @AccountRequired()
  @Put()
  save(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: SaveLoadoutDto,
  ): Promise<LoadoutDto> {
    return this.loadout.save(user.sub, dto.vehicleCardIds, dto.supportCardIds);
  }
}
