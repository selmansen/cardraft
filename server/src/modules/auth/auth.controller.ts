import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public } from '../../common/decorators/auth.decorators.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
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
@ApiTags('Kimlik')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  /**
   * Misafir oturumu açar; oyuncu hiçbir şey yazmadan oynamaya başlayabilsin diye.
   *
   * `installationId` gönderilmezse sunucu üretip yanıtta geri verir — istemci
   * saklayıp sonraki açılışlarda gönderir ve aynı hesaba döner. Üretimin
   * sunucuda olmasının sebebi bu alanın fiilen giriş anahtarı olması: tahmin
   * edilemez olmak zorunda, React Native tarafında ise güvenilir rastgelelik yok.
   */
  @Public()
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  guest(@Body() dto: GuestLoginDto): Promise<AuthTokensDto> {
    return this.auth.loginAsGuest(dto);
  }

  /**
   * Sıfırdan e-postalı hesap açar.
   *
   * Misafirken ilerleme kaydetmiş bir oyuncu için YANLIŞ uç: burası yeni ve boş
   * bir hesap yaratır. O durumda `POST /auth/link` kullanılmalı.
   */
  // Kaba kuvvete karşı sıkı sınır: argon2 şifreyi koruyor ama saniyede
  // yüzlerce deneme hem zayıf şifreleri bulur hem sunucuyu boğar
  // (argon2 bilerek pahalı).
  @RateLimit(10, 60)
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.auth.register(dto);
  }

  /** E-postalı hesapla giriş. */
  // Kaba kuvvete karşı sıkı sınır: argon2 şifreyi koruyor ama saniyede
  // yüzlerce deneme hem zayıf şifreleri bulur hem sunucuyu boğar
  // (argon2 bilerek pahalı).
  @RateLimit(10, 60)
  @Public()
  @Post('login')
  // Varsayılan 201 yerine 200: yeni bir kaynak yaratılmıyor, oturum açılıyor.
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.auth.login(dto);
  }

  /**
   * Süresi dolan access token'ın yerine yenisini verir.
   *
   * Refresh token rotasyonlu: her yenilemede eskisi geçersizleşir. Çalınan bir
   * token'ın süresiz kullanılmasını engelleyen şey bu.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokensDto> {
    return this.tokens.rotate(dto.refreshToken);
  }

  /** Refresh token'ı iptal eder. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    // Bilerek @Public: access token süresi dolmuş olsa bile kullanıcı
    // çıkabilmeli. Refresh token'ın kendisi zaten yetki kanıtı.
    await this.tokens.revoke(dto.refreshToken);
  }

  /** Misafir → gerçek hesap. Kimlik doğrulaması ŞART (public değil). */
  @ApiBearerAuth('access-token')
  @Post('link')
  @HttpCode(HttpStatus.OK)
  link(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: LinkAccountDto,
  ): Promise<AuthTokensDto> {
    return this.auth.linkGuestToAccount(user.sub, dto);
  }

  /** Oturumdaki kullanıcı. Token'ın hâlâ geçerli olduğunu sınamanın en hızlı yolu. */
  @ApiBearerAuth('access-token')
  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.users.findById(user.sub);
  }
}
