import { Module, type DynamicModule } from '@nestjs/common';

import { EconomyModule } from '../economy/economy.module.js';
import { DevController } from './dev.controller.js';

/**
 * GEÇİCİ — GELİŞTİRME ARACI. Silinmek üzere yazıldı (bkz. dev.controller.ts).
 *
 * `register()` bir fabrika, statik bir `@Module` değil: ortam kontrolü
 * derleme zamanında değil kayıt anında yapılıyor ve üretimde denetleyici
 * MODÜLE HİÇ GİRMİYOR. IdentityModule'deki sahte doğrulayıcı seçimiyle aynı
 * gerekçe — güvenliği "unutulmayacak bir adıma" değil, yapının kendisine
 * bağlamak.
 */
@Module({})
export class DevModule {
  static register(): DynamicModule {
    if (process.env.NODE_ENV === 'production') {
      return { module: DevModule };
    }
    return {
      module: DevModule,
      imports: [EconomyModule],
      controllers: [DevController],
    };
  }
}
