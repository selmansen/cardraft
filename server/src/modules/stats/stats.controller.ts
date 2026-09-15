import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { StatsService, type PlayerStats } from './stats.service.js';

@ApiTags('İstatistik')
@ApiBearerAuth('access-token')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /**
   * Oyuncunun kendi istatistikleri.
   *
   * Sayaçlar yalnızca DOĞRULANMIŞ maç sonucuyla artıyor (bkz. ADR 0008), yani
   * bu rakamlar istemcinin bildirdiği bir şey değil. Profil ekranı burayı
   * okuyor; yerel sayaçlar yalnızca çevrimdışı oynanan maçları biliyor ve
   * onları göstermek bağlı oyuncuya yanlış rakam söylemek olurdu.
   */
  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload): Promise<PlayerStats> {
    return this.stats.get(user.sub);
  }
}
