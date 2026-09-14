import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { DevicesModule } from '../devices/devices.module.js';
import { EconomyModule } from '../economy/economy.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AccountService } from './account.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TokenService } from './token.service.js';

/**
 * JwtModule burada gizli anahtar VERİLMEDEN kaydediliyor: imzalama ve
 * doğrulama sırlarını her çağrıda açıkça geçiyoruz (TokenService ve
 * JwtStrategy). Sebep: access ve refresh farklı sırlar kullanıyor — modül
 * seviyesinde tek bir sır tanımlamak, birinin yanlışlıkla diğerinin sırrıyla
 * imzalanması riskini doğururdu.
 */
@Module({
  imports: [
    UsersModule,
    DevicesModule,
    EconomyModule,
    InventoryModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, AuthTokenService, AccountService],
  exports: [TokenService],
})
export class AuthModule {}
