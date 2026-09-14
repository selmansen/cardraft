import { Module } from '@nestjs/common';

import { BattleRewardService } from './battle-reward.service.js';
import { EconomyController } from './economy.controller.js';
import { EconomyService } from './economy.service.js';

@Module({
  controllers: [EconomyController],
  providers: [EconomyService, BattleRewardService],
  // EconomyService dışa açık: envanter (kart açma/yükseltme) ve ileride
  // mağaza satın alması bunun üzerinden harcama yapacak. Para hareketinin
  // tek kapısı olması, tutarlılığın tek yerde korunması demek.
  exports: [EconomyService, BattleRewardService],
})
export class EconomyModule {}
