import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/mapped-types';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { DeviceInfoDto } from '../../../common/dto/device-info.dto.js';

/**
 * Kimlik DTO'ları.
 *
 * Hepsi tek bir "kimlik bilgileri" tabanından türüyor. `PickType` /
 * `IntersectionType` (NestJS'in mapped-types'ı) burada tam olarak DRY için
 * var: aynı alanı iki DTO'da tanımlarsan doğrulama kuralları zamanla birbirinden
 * ayrışıyor — mesela şifre alt sınırını bir yerde 8'den 10'a çıkarıp diğerini
 * unutmak. Türetilmiş tipte bu mümkün değil, kural tek yerde.
 */
class AuthCredentialsDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi gerekli' })
  @MaxLength(254)
  email!: string;

  @IsString()
  // 8 karakter alt sınırı: NIST'in güncel önerisi uzunluğu karmaşıklık
  // kurallarına (büyük harf/rakam zorunluluğu) tercih ediyor — karmaşıklık
  // kuralları kullanıcıyı tahmin edilebilir kalıplara itiyor.
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  displayName?: string;
}

/** Kayıt: kimlik bilgileri + hangi cihazdan (ilk oturum o cihaza bağlanır). */
export class RegisterDto extends IntersectionType(AuthCredentialsDto, DeviceInfoDto) {}

/** Giriş: displayName'in burada işi yok, o yüzden sadece iki alan seçiliyor. */
export class LoginDto extends IntersectionType(
  PickType(AuthCredentialsDto, ['email', 'password'] as const),
  DeviceInfoDto,
) {}

/**
 * Misafir giriş: hiç kimlik bilgisi yok, sadece cihaz.
 *
 * `installationId` burada — ve YALNIZCA burada — isteğe bağlı. Sebep güvenlik:
 * bu alan misafir hesabın fiili giriş anahtarı (bilen kişi o hesaba giriyor),
 * dolayısıyla TAHMİN EDİLEMEZ olmak zorunda. İstemci tarafında güvenilir
 * rastgelelik yok — React Native/Hermes `crypto.getRandomValues` sağlamıyor ve
 * `Math.random` bir kimlik anahtarı üretmek için uygun değil. Bu yüzden ilk
 * çağrıda alan boş gönderiliyor ve sunucu `randomUUID` ile üretip yanıtta
 * geri veriyor; istemci saklayıp sonraki çağrılarda gönderiyor.
 *
 * Alanın kuralları (uzunluk sınırları) yine `DeviceInfoDto`'dan geliyor —
 * sadece "zorunlu" olma durumu gevşetiliyor, kural kopyalanmıyor.
 */
export class GuestLoginDto extends IntersectionType(
  OmitType(DeviceInfoDto, ['installationId'] as const),
  PartialType(PickType(DeviceInfoDto, ['installationId'] as const)),
) {}

/**
 * Misafir hesabı gerçek hesaba yükseltme. Cihaz bilgisi gerekmiyor: kullanıcı
 * zaten kimliği doğrulanmış olarak geliyor, hangi cihazdan olduğu access
 * token'dan biliniyor.
 */
export class LinkAccountDto extends AuthCredentialsDto {}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
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
  /**
   * Yalnızca misafir girişinde dolu: istemcinin saklaması gereken kurulum
   * kimliği. Sunucu ürettiği için istemcinin rastgelelik kalitesine bağlı
   * değil (bkz. GuestLoginDto).
   */
  installationId?: string;
}
