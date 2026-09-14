import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { TypedConfigService } from '../../../config/app-config.module.js';
import type { AccessTokenPayload } from '../token.service.js';

/**
 * Access token'ı doğrular ve `request.user`'a yerleştirir.
 *
 * Burada bilerek VERİTABANINA GİDİLMİYOR. Her istekte kullanıcıyı DB'den
 * çekmek, JWT kullanmanın tek gerçek faydasını (durumsuz doğrulama) yok
 * ederdi. Token'ın içindeki id + imza doğruluğu yetiyor; kullanıcının silinmiş
 * olma ihtimali access token'ın 15 dakikalık ömrüyle sınırlı bir risk ve
 * bunun karşılığında her istek bir sorgudan kurtuluyor.
 *
 * Kullanıcı verisine gerçekten ihtiyaç duyan uç noktalar onu kendisi çeker
 * (örn. /me) — o zaman sorgu maliyeti o uç noktaya ait olur, hepsine değil.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: TypedConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AccessTokenPayload): AccessTokenPayload {
    return payload;
  }
}
