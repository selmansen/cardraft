import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { RegisterDeviceDto } from './dto/device.dto.js';
import { DevicesService } from './devices.service.js';

@ApiTags('Cihaz')
@ApiBearerAuth('access-token')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /**
   * Cihazı kaydeder/günceller ve varsa push jetonunu bağlar.
   *
   * POST ama "upsert": istemci uygulama her açılışında burayı çağırabilsin,
   * daha önce kaydolup kaydolmadığını takip etmek zorunda kalmasın. Sunucu
   * tarafında idempotent olduğu için tekrarlanan çağrı zararsız.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async register(@CurrentUser() user: AccessTokenPayload, @Body() dto: RegisterDeviceDto) {
    const device = await this.devices.register(user.sub, dto);
    if (dto.fcmToken) {
      await this.devices.savePushToken(device.id, dto.fcmToken);
    }
    return device;
  }

  /**
   * Hesaba bağlı cihazlar.
   *
   * Son görülme zamanı burada tutuluyor; 24 saattir girmeyene gönderilen
   * hatırlatma bildirimi bu veriye dayanıyor.
   */
  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.devices.listForUser(user.sub);
  }

  /** Cihaz kaydını ve ona bağlı push jetonunu siler. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AccessTokenPayload,
    // ParseUUIDPipe: geçersiz biçimli id veritabanına hiç ulaşmıyor.
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.devices.remove(user.sub, id);
  }
}
