import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { OpenPackDto } from './dto/store.dto.js';
import { StoreService } from './store.service.js';

@ApiTags('Mağaza')
@ApiBearerAuth('access-token')
@Controller('store')
export class StoreController {
  constructor(private readonly store: StoreService) {}

  /**
   * Satıştaki paketler — fiyatları ve çıkma oranlarıyla.
   *
   * Oranlar istemcide sabit yazılmıyor, buradan geliyor: mağaza ekranında
   * gösterilen oranla çekilişte kullanılan oranın aynı olması hem dürüstlük
   * hem mağaza politikası meselesi.
   */
  @Get('packs')
  packs() {
    return this.store.listPacks();
  }

  /**
   * Paket açar. Fiyatı, oranları ve çıkan kartı sunucu belirler.
   *
   * Gövdedeki `requestId` tekrar koruması: aynı kimlikle gelen ikinci istek
   * yeni bir çekiliş yapmaz, ilk açılışın sonucunu döndürür. Mobil ağda
   * cevabı kaybolan bir isteğin oyuncudan iki kez para düşürmesini
   * engelleyen tek şey bu.
   */
  @Post('packs/:id/open')
  @HttpCode(HttpStatus.OK)
  open(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: OpenPackDto,
  ) {
    return this.store.openPack(user.sub, id, dto.requestId);
  }
}
