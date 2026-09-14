import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../../../common/decorators/auth.decorators.js';

/**
 * Global kimlik kontrolü. @Public() işaretli uç noktalarda kenara çekilir.
 *
 * `getAllAndOverride` sırası önemli: önce metoda, sonra sınıfa bakıyor.
 * Böylece bir controller tümüyle public işaretlenip içindeki tek bir metot
 * korumalı yapılabiliyor (ya da tersi) — kural en yakın tanımdan geliyor.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
