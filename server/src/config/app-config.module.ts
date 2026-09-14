import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { validateEnv, type Env } from './env.schema.js';

/**
 * Tipli yapılandırma erişimi.
 *
 * NestJS'in kendi ConfigService'i `get('PORT')` çağrısında `string | undefined`
 * döner — her kullanım yerinde tip daraltma ve varsayılan tekrarı gerekir. Bu
 * sarmalayıcı, zod'un çıkardığı `Env` tipini kullanarak `get('PORT')`'un
 * `number` döndürmesini sağlıyor: tek bir yerde doğrulanan bilgi, her yerde
 * tipli olarak kullanılıyor (DRY'ın tip tarafındaki karşılığı).
 */
export class TypedConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true }) as Env[K];
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Şema doğrulaması: geçersiz env ile uygulama hiç açılmaz.
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: TypedConfigService,
      useFactory: (config: ConfigService<Env, true>) => new TypedConfigService(config),
      inject: [ConfigService],
    },
  ],
  exports: [TypedConfigService],
})
export class AppConfigModule {}
