import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './config/app-config.module.js';
import { CacheModule } from './infrastructure/cache/cache.module.js';
import { HealthController } from './infrastructure/health/health.controller.js';
import { NotificationModule } from './infrastructure/notification/notification.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { QueueModule } from './infrastructure/queue/queue.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { EconomyModule } from './modules/economy/economy.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { MatchModule } from './modules/match/match.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { StatsModule } from './modules/stats/stats.module.js';
import { StoreModule } from './modules/store/store.module.js';
import { UsersModule } from './modules/users/users.module.js';

/**
 * Kök modül sadece "neyin var olduğunu" söyler, iş yapmaz.
 *
 * Sıralama önemli değil (NestJS bağımlılıkları kendisi çözer) ama gruplama
 * okunabilirlik için: önce yapılandırma, sonra altyapı, sonra iş modülleri
 * (auth/devices birazdan buraya eklenecek).
 */
@Module({
  imports: [
    // Yapılandırma: diğer her şey buna bağlı, bu yüzden ilk.
    AppConfigModule,
    // Altyapı: global işaretli, iş modülleri ayrıca import etmeden kullanır.
    PrismaModule,
    CacheModule,
    QueueModule,
    NotificationModule,
    // İş modülleri.
    UsersModule,
    DevicesModule,
    AuthModule,
    EconomyModule,
    InventoryModule,
    MatchModule,
    NotificationsModule,
    StatsModule,
    StoreModule,
  ],
  controllers: [HealthController],
  providers: [
    // Kimlik kontrolü global: her uç nokta varsayılan olarak KAPALI, açmak
    // için @Public() gerekiyor. Bkz. common/decorators/auth.decorators.ts —
    // güvenliği unutulabilecek bir adıma değil, varsayılana bağlamak.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    /**
     * Hız sınırı JwtAuthGuard'dan SONRA: sıra önemli, çünkü sayaç anahtarı
     * kimlik doğrulanmışsa kullanıcıya, değilse IP'ye bağlanıyor ve
     * `request.user` ancak auth guard çalıştıktan sonra dolu oluyor.
     * NestJS global guard'ları tanımlanma sırasıyla çalıştırıyor.
     */
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
