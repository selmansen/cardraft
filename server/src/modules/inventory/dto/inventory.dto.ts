import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

import { CurrencyCode } from '../../../generated/prisma/enums.js';

export class UnlockCardDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  cardId!: string;

  /**
   * Hangi keseden ödeneceği. Zorunlu — varsayılan vermek tehlikeli olurdu:
   * istemcinin niyetini tahmin edip yanlış para birimini harcamak,
   * kullanıcının geri alamayacağı bir hata.
   */
  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;
}
