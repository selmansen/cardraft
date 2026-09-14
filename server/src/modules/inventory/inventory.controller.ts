import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { UnlockCardDto } from './dto/inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** Oyuncunun koleksiyonu. Kadro kurarken istemcinin dayandığı liste. */
  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.inventory.list(user.sub);
  }

  /**
   * Kart açma. İstemci FİYAT göndermiyor — sadece hangi kart ve hangi
   * keseden. Fiyata sunucu karar veriyor (card-catalog.ts).
   */
  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  unlock(@CurrentUser() user: AccessTokenPayload, @Body() dto: UnlockCardDto) {
    return this.inventory.unlock(user.sub, dto.cardId, dto.currency);
  }
}
