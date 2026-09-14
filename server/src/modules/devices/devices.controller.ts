import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IntersectionType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentUser } from '../../common/decorators/auth.decorators.js';
import { DeviceInfoDto } from '../../common/dto/device-info.dto.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { DevicesService } from './devices.service.js';

class PushTokenDto {
  /** FCM jetonu opsiyonel: kullanıcı bildirim iznini reddetmiş olabilir,
   *  cihaz kaydı yine de tutulmalı (oturum listesi için). */
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  fcmToken?: string;
}

/** Cihaz bilgisi + push jetonu — ikisi tek istekte, ikisi de zaten tanımlı. */
class RegisterDeviceDto extends IntersectionType(DeviceInfoDto, PushTokenDto) {}

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

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.devices.listForUser(user.sub);
  }

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
