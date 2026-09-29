import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module.js';
import { LoadoutController } from './loadout.controller.js';
import { LoadoutService } from './loadout.service.js';

@Module({
  imports: [InventoryModule],
  controllers: [LoadoutController],
  providers: [LoadoutService],
  exports: [LoadoutService],
})
export class LoadoutModule {}
