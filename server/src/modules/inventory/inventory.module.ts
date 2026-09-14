import { Module } from '@nestjs/common';

import { EconomyModule } from '../economy/economy.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [EconomyModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  // AuthService başlangıç kartlarını vermek için buna ihtiyaç duyuyor.
  exports: [InventoryService],
})
export class InventoryModule {}
