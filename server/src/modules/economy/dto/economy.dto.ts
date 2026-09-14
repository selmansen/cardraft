import { IntersectionType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { CurrencyCode } from '../../../generated/prisma/enums.js';

/** Hangi para birimi — birden fazla uç noktada gerekiyor, bir kez tanımlı. */
class CurrencyQueryDto {
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency: CurrencyCode = CurrencyCode.COIN;
}

/** Geçmiş sorgusu: sayfalama + para birimi. İkisi de zaten tanımlı, birleşiyor. */
export class LedgerQueryDto extends IntersectionType(PaginationQueryDto, CurrencyQueryDto) {}
