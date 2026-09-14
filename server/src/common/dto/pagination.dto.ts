import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Sayfalama parametreleri — listeleyen her uç nokta bunu miras alır ya da
 * birleştirir (IntersectionType). Amaç: "page/limit" doğrulama kurallarının
 * her DTO'da yeniden yazılmaması.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // Üst sınır bilinçli: istemcinin `limit=100000` diyerek veritabanını
  // kilitlemesini engelleyen şey bu satır.
  @Max(100)
  limit: number = 20;
}

/** Sayfalı yanıtların ortak zarfı. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
