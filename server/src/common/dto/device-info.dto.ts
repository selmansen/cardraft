import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { DevicePlatform } from '../../generated/prisma/enums.js';

/**
 * Cihaz kimliği — İKİ ayrı yerde gerekiyor: misafir girişinde (hangi cihaz
 * için hesap açılıyor) ve cihaz kaydında (push için). İki DTO'da aynı üç
 * alanı ve aynı doğrulama kurallarını tekrar yazmak yerine burada bir kez
 * tanımlanıp `IntersectionType` ile birleştiriliyor.
 *
 * Kural tekrarının somut zararı: `installationId`'nin uzunluk sınırını
 * ileride değiştirmek gerektiğinde iki yerden birini güncellemeyi unutmak,
 * ve iki uç noktanın sessizce farklı kurallarla çalışmaya başlaması.
 */
export class DeviceInfoDto {
  /**
   * Uygulamanın o cihazdaki kurulumunu tanımlayan kimlik. İstemci üretir
   * (expo-application / kendi ürettiği uuid) ve saklar. Donanım kimliği
   * DEĞİL: iOS kalıcı donanım kimliği vermiyor, zorlamak da mağaza
   * politikalarıyla sorun yaratır.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  installationId!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}
