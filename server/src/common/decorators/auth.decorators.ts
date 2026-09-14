import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AccessTokenPayload } from '../../modules/auth/token.service.js';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Kimlik doğrulamayı atlar.
 *
 * Varsayılan bilinçli olarak TERS kuruldu: guard global, yani her uç nokta
 * kapalı doğuyor ve açmak için açıkça @Public() yazmak gerekiyor. Tersi
 * (varsayılan açık, korumak için @UseGuards yazmak) çok daha riskli — birinin
 * yeni bir uç nokta yazıp dekoratörü unutması, sessizce herkese açık bir
 * kapı bırakır. Unutmanın cezası bu kurulumda "401 alıyorum, neden?" olur;
 * diğerinde "verilerim açıkta".
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** İsteği yapan kullanıcıyı doğrudan parametre olarak verir. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: AccessTokenPayload }>();
    return request.user;
  },
);
