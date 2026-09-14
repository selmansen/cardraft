import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { DeviceInfoDto } from '../../../common/dto/device-info.dto.js';
import { IdentityProvider } from '../../../generated/prisma/enums.js';

/**
 * Kimlik DTO'ları.
 *
 * E-posta + şifre kaldırıldı: giriş yalnızca Apple ya da Google ile.
 * Sağlayıcı hem kimliği hem e-postayı bizden daha iyi doğruluyor, ve şifre
 * olmayınca sıfırlama/doğrulama/kaba kuvvet yüzeyleri de olmuyor.
 */

/**
 * Misafir giriş: hiç kimlik bilgisi yok, sadece cihaz.
 *
 * `installationId` burada — ve yalnızca burada — isteğe bağlı. Sebep
 * güvenlik: bu alan misafir hesabın fiili giriş anahtarı, dolayısıyla TAHMİN
 * EDİLEMEZ olmak zorunda. İstemci tarafında güvenilir rastgelelik yok —
 * React Native/Hermes `crypto.getRandomValues` sağlamıyor ve `Math.random`
 * bir kimlik anahtarı üretmek için uygun değil. Bu yüzden ilk çağrıda alan
 * boş gönderiliyor ve sunucu `randomUUID` ile üretip yanıtta geri veriyor.
 */
export class GuestLoginDto extends IntersectionType(
  OmitType(DeviceInfoDto, ['installationId'] as const),
  PartialType(PickType(DeviceInfoDto, ['installationId'] as const)),
) {}

/** Apple / Google ile giriş — sağlayıcının verdiği kimlik jetonu + cihaz. */
export class ProviderSignInDto extends DeviceInfoDto {
  @IsEnum(IdentityProvider)
  provider!: IdentityProvider;

  /** Sağlayıcının döndürdüğü imzalı kimlik jetonu (JWT). */
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  idToken!: string;

}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

/**
 * Hesap silme onayı. Bağlı hesapta sağlayıcıdan TAZE bir jeton isteniyor:
 * access token 15 dakika yaşıyor ve silme geri alınamaz, telefonu kısa
 * süreliğine eline geçiren birinin hesabı silebilmesi kabul edilemez.
 * Misafir hesapta kimlik olmadığı için alanlar opsiyonel.
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsEnum(IdentityProvider)
  provider?: IdentityProvider;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  idToken?: string;
}

/** Tüm kimlik uç noktalarının ortak yanıtı. */
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    isGuest: boolean;
  };
  /** Yalnızca misafir girişinde dolu. */
  installationId?: string;
}
