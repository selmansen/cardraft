import { Module } from '@nestjs/common';

import { EconomyModule } from '../economy/economy.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { StatsModule } from '../stats/stats.module.js';
import { MatchController } from './match.controller.js';
import { MatchVerifier } from './match-verifier.js';
import { MatchService } from './match.service.js';

@Module({
  imports: [EconomyModule, InventoryModule, StatsModule],
  controllers: [MatchController],
  providers: [MatchService, MatchVerifier],
})
export class MatchModule {}
