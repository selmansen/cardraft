import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Public } from '../../common/decorators/auth.decorators.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { UsersService } from '../users/users.service.js';
import { AccountService } from './account.service.js';
import { AuthService } from './auth.service.js';
import { IdentityService } from './identity.service.js';
import {
  DeleteAccountDto,
  GuestLoginDto,
  ProviderSignInDto,
  RefreshDto,
  type AuthTokensDto,
} from './dto/auth.dto.js';
import type { AccessTokenPayload } from './token.service.js';
import { TokenService } from './token.service.js';

/**
 * Controller katmanı BİLEREK ince: HTTP ayrıntısı (yol, durum kodu, gövde
 * çözme) burada, iş kuralı serviste. Ayrımın pratik faydası — aynı akışı
 * yarın bir WebSocket ya da kuyruk işçisinden çağırmak gerekirse servis
 * olduğu gibi kullanılabiliyor.
 */
@ApiTags('Kimlik')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly identity: IdentityService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly account: AccountService,
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
   * Apple ya da Google ile giriş — tek gerçek giriş yolu.
   *
   * Kimlik doğrulaması ŞART (public değil): çağıran her zaman oturum açmış
   * durumda, çünkü uygulama açılışta misafir hesap alıyor. Böylece bu tek uç
   * üç işi birden yapıyor: misafiri yükseltmek, daha önce bağlanmış hesaba
   * dönmek, ve cihaz değiştiren oyuncunun hesabını geri vermek.
   *
   * Sağlayıcı hesabı BAŞKA bir CarDraft hesabına bağlıysa ve buradaki misafir
   * hesabın ilerlemesi varsa **409** dönüyor: `force` gelmeden geçiş yok,
   * yoksa oyuncunun saatleri sessizce silinirdi.
   */
  @RateLimit(20, 60)
  @ApiBearerAuth('access-token')
  @Post('identity')
  @HttpCode(HttpStatus.OK)
  signInWithProvider(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ProviderSignInDto,
  ): Promise<AuthTokensDto> {
    return this.identity.signIn(user.sub, dto.provider, dto.idToken, dto, dto.force ?? false);
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

  /**
   * Hesabı ve bağlı bütün veriyi siler.
   *
   * Apple App Store, hesap açmaya izin veren uygulamanın silmeye de izin
   * vermesini şart koşuyor (5.1.1(v)) — yayın engeli, incelik değil.
   * Bağlı hesapta sağlayıcıdan taze jeton isteniyor: silme geri alınamaz ve
   * access token 15 dakika yaşıyor.
   */
  @ApiBearerAuth('access-token')
  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.account.deleteAccount(
      user.sub,
      dto.provider && dto.idToken ? { provider: dto.provider, idToken: dto.idToken } : undefined,
    );
  }

  /** Oturumdaki kullanıcı. Token'ın hâlâ geçerli olduğunu sınamanın en hızlı yolu. */
  @ApiBearerAuth('access-token')
  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.users.findById(user.sub);
  }
}
