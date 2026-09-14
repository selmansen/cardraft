import { IntersectionType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { DeviceInfoDto } from '../../../common/dto/device-info.dto.js';

export class PushTokenDto {
  /**
   * FCM jetonu opsiyonel: kullanıcı bildirim iznini reddetmiş olabilir,
   * cihaz kaydı yine de tutulmalı (oturum listesi için).
   */
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  fcmToken?: string;
}

/** Cihaz bilgisi + push jetonu — ikisi tek istekte, ikisi de zaten tanımlı. */
export class RegisterDeviceDto extends IntersectionType(DeviceInfoDto, PushTokenDto) {}
