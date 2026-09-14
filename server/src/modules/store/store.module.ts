import { Module } from '@nestjs/common';

import { EconomyModule } from '../economy/economy.module.js';
import { StoreController } from './store.controller.js';
import { StoreService } from './store.service.js';

@Module({
  imports: [EconomyModule],
  controllers: [StoreController],
  providers: [StoreService],
})
export class StoreModule {}
