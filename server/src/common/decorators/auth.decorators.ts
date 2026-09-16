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

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Jeton VARSA doğrular, yoksa isteği yine de geçirir.
 *
 * @Public() ile farkı: @Public jetona hiç bakmıyor, bu ise bakıyor ve
 * geçerliyse `request.user`'ı dolduruyor. Aradaki fark, aynı ucun hem
 * oturumlu hem oturumsuz çalışması gerektiğinde önemli — giriş ucu tam
 * olarak böyle: oturum varsa misafiri yükseltiyor, yoksa kimliğin sahibi
 * olan hesaba giriş yapıyor.
 *
 * Geçersiz/süresi dolmuş jeton da reddedilmiyor, yok sayılıyor: zaten bu
 * uca gelinmesinin sebebi çoğu zaman jetonun artık işe yaramaması.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

/**
 * İsteği yapan kullanıcıyı doğrudan parametre olarak verir.
 *
 * Korumalı uçlarda her zaman dolu (guard olmadan oraya gelinemiyor).
 * @OptionalAuth() işaretli uçlarda boş olabilir — o uçlar parametreyi
 * `AccessTokenPayload | undefined` olarak almalı.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    return request.user;
  },
);
