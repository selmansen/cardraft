import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimit {
  /** Pencere içinde izin verilen istek sayısı. */
  limit: number;
  /** Pencere uzunluğu (saniye). */
  windowSeconds: number;
}

/**
 * Bir uç noktanın hız sınırını daraltır.
 *
 * Varsayılan sınır bütün uçlara global guard'dan uygulanıyor; bu dekoratör
 * yalnızca DAHA SIKI olması gereken yerler için — giriş denemeleri gibi.
 */
export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimit);
