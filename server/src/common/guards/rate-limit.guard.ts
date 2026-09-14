import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { RATE_LIMIT_KEY, type RateLimit } from '../decorators/rate-limit.decorator.js';

/** Hiçbir dekoratör yoksa geçerli olan sınır. */
const DEFAULT: RateLimit = { limit: 120, windowSeconds: 60 };

/**
 * Hız sınırlama — sayaç Redis'te.
 *
 * NEDEN HAZIR PAKET DEĞİL: `@nestjs/throttler` henüz NestJS 12'yi peer
 * bağımlılığında desteklemiyor (kurulum ERESOLVE ile düşüyor) ve varsayılan
 * deposu süreç belleği. Bellek içi sayaç tek örnekte çalışır; AWS'te iki
 * örneğe çıkıldığı gün sınır kendiliğinden ikiye katlanır ve kimse fark
 * etmez. Redis zaten kuyruğun altında çalışıyor, sayaç da oraya yazılıyor.
 *
 * NEDEN ÖNEMLİ: sınır olmadan `/auth/login` kaba kuvvete açık — argon2
 * şifreyi koruyor ama saniyede yüzlerce deneme hem zayıf şifreleri bulur hem
 * sunucuyu (argon2 bilerek pahalı) boğar. Paket açma ve maç uçları da para
 * hareketi üretiyor.
 *
 * REDIS DÜŞERSE İSTEK GEÇER. Bilinçli: hız sınırlama bir hızlandırma değil
 * koruma katmanı, ama önbellek düştüğünde bütün oyunu kapatmak orantısız bir
 * ceza. Düşüş loglanıyor.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule =
      this.reflector.getAllAndOverride<RateLimit>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT;

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      user?: { sub?: string };
      route?: { path?: string };
      method?: string;
    }>();

    /**
     * Kimlik doğrulanmışsa KULLANICI, değilse IP.
     *
     * Yalnızca IP kullanmak, aynı mobil operatörün NAT'ı arkasındaki binlerce
     * oyuncuyu tek sayaca toplardı. Yalnızca kullanıcı kullanmak ise giriş
     * uçlarında işe yaramazdı — orada henüz kullanıcı yok.
     */
    const who = request.user?.sub ?? request.ip ?? 'bilinmeyen';
    const where = `${request.method ?? '?'}:${request.route?.path ?? '?'}`;
    const key = `rl:${where}:${who}`;

    let count: number;
    try {
      count = await this.cache.increment(key, rule.windowSeconds);
    } catch (error) {
      this.logger.warn(`Hız sayacı okunamadı, istek geçiriliyor: ${(error as Error).message}`);
      return true;
    }

    if (count > rule.limit) {
      throw new HttpException(
        'Çok fazla istek gönderdin. Biraz bekleyip tekrar dene.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
