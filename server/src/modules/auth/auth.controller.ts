import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentUser, Public } from '../../common/decorators/auth.decorators.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import {
  GuestLoginDto,
  LinkAccountDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  type AuthTokensDto,
} from './dto/auth.dto.js';
import type { AccessTokenPayload } from './token.service.js';
import { TokenService } from './token.service.js';

/**
 * Controller katmanı BİLEREK ince: HTTP ayrıntısı (yol, durum kodu, gövde
 * çözme) burada, iş kuralı serviste. Ayrımın pratik faydası — aynı akışı
 * yarın bir WebSocket ya da kuyruk işçisinden çağırmak gerekirse servis
 * olduğu gibi kullanılabiliyor; HTTP'ye bağımlı olsaydı kopyalamak gerekirdi.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  guest(@Body() dto: GuestLoginDto): Promise<AuthTokensDto> {
    return this.auth.loginAsGuest(dto);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  // Varsayılan 201 yerine 200: yeni bir kaynak yaratılmıyor, oturum açılıyor.
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokensDto> {
    return this.tokens.rotate(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    // Bilerek @Public: access token süresi dolmuş olsa bile kullanıcı
    // çıkabilmeli. Refresh token'ın kendisi zaten yetki kanıtı.
    await this.tokens.revoke(dto.refreshToken);
  }

  /** Misafir → gerçek hesap. Kimlik doğrulaması ŞART (public değil). */
  @Post('link')
  @HttpCode(HttpStatus.OK)
  link(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: LinkAccountDto,
  ): Promise<AuthTokensDto> {
    return this.auth.linkGuestToAccount(user.sub, dto);
  }

  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.users.findById(user.sub);
  }
}
