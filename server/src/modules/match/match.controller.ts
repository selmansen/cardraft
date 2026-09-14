import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { OpenMatchDto, SubmitMatchDto } from './dto/match.dto.js';
import { MatchService } from './match.service.js';

@Controller('matches')
export class MatchController {
  constructor(private readonly matches: MatchService) {}

  /** Maç oturumu açar; tohum ve bot kurulumu sunucudan gelir. */
  @Post()
  open(@CurrentUser() user: AccessTokenPayload, @Body() dto: OpenMatchDto) {
    return this.matches.open(user.sub, dto);
  }

  /**
   * Maçı sonuçlandırır. Gövdede "kazandım" bilgisi YOK — sadece hamleler.
   * Kazananı sunucu, maçı yeniden oynatarak buluyor.
   */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitMatchDto,
  ) {
    return this.matches.submit(user.sub, id, dto);
  }
}
