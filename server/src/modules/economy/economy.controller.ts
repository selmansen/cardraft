import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { LedgerQueryDto } from './dto/economy.dto.js';
import { EconomyService } from './economy.service.js';

@ApiTags('Ekonomi')
@ApiBearerAuth('access-token')
@Controller('economy')
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  /** Tüm bakiyeler. İstemcinin gösterdiği rakamın doğruluk kaynağı burası. */
  @Get('wallet')
  balances(@CurrentUser() user: AccessTokenPayload) {
    return this.economy.balances(user.sub);
  }

  /**
   * Bakiyeyi oluşturan hareketlerin dökümü: kayıt bonusu, maç ödülü, harcama.
   *
   * Bakiye tek başına saklanmıyor, her değişim deftere yazılıyor — "jantım neden
   * azaldı" sorusunun cevabı ancak böyle verilebiliyor.
   */
  @Get('ledger')
  history(@CurrentUser() user: AccessTokenPayload, @Query() query: LedgerQueryDto) {
    return this.economy.history(user.sub, query.currency, query.page, query.limit);
  }

  // KALDIRILDI: POST /economy/battle-reward.
  //
  // "Tutarı istemci göndermiyor, sadece sonucu" yeterli sanılmıştı. Değildi:
  // istemci her seferinde uydurma bir battleId üretip `won: true` diyebiliyor,
  // idempotency anahtarı da o uydurma kimlik olduğu için her çağrı yeni bir
  // ödül yazıyordu. Yani sonsuz jant.
  //
  // Ödülün tek yolu artık POST /matches/:id/submit: maçı sunucu açıyor
  // (tohum ve bot kurulumu sunucudan), istemci yalnızca hamleleri gönderiyor,
  // sunucu maçı yeniden oynatıp kazananı KENDİ buluyor. Ödül o sonuca bağlı.
  // Bkz. docs/adr/0007-server-side-match-verification.md.
}
