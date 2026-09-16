import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from '../../../common/decorators/auth.decorators.js';

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

  /**
   * @OptionalAuth() işaretli uçta doğrulama hatası isteği düşürmüyor:
   * `request.user` boş kalıyor ve karar servise bırakılıyor.
   *
   * Passport varsayılanı "kullanıcı yoksa 401" ve bu, giriş ucunda
   * kilitlenmeye yol açıyordu: oturum geçersizleşmiş bir oyuncu giriş
   * yapamıyor, giriş yapamadığı için de yeni oturum alamıyordu.
   */
  handleRequest<TUser>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
    const optional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (optional && (err || !user)) return undefined as TUser;
    return super.handleRequest(err, user, info, context) as TUser;
  }
}
