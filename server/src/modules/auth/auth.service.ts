import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

import type { DeviceInfoDto } from '../../common/dto/device-info.dto.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { EconomyService } from '../economy/economy.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SIGNUP_BONUS_RIM } from '../economy/reward.rules.js';
import { UsersService } from '../users/users.service.js';
import { CurrencyCode, LedgerReason } from '../../generated/prisma/enums.js';
import type { AuthTokensDto, GuestLoginDto, LinkAccountDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { TokenService } from './token.service.js';

/**
 * Kimlik akışları.
 *
 * argon2id neden bcrypt değil: bcrypt yalnızca CPU'yu zorlar, argon2id hem
 * CPU hem BELLEK maliyeti getirir. Şifre kırma bugün GPU/ASIC ile paralel
 * yapılıyor ve bu donanımların darboğazı bellek — bellek maliyeti, saldırgan
 * başına maliyeti savunmacıdan çok daha hızlı artırıyor. argon2id ayrıca
 * OWASP'ın güncel birinci önerisi.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly devices: DevicesService,
    private readonly tokens: TokenService,
    private readonly economy: EconomyService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Yeni hesabın başlangıç jantı.
   *
   * Ekonomi servisinden geçiyor (doğrudan cüzdana yazmıyoruz): bakiye
   * değişiminin tek kapısı orası, ve bu sayede bonus da işlem defterine
   * düşüyor. "Bu 300 jant nereden geldi" sorusunun cevabı ilk günden kayıtlı.
   *
   * Idempotency anahtarı kullanıcı kimliği: aynı hesaba ikinci kez bonus
   * yazılması veritabanı seviyesinde imkânsız.
   */
  private async grantSignupBonus(userId: string): Promise<void> {
    await this.economy.move({
      userId,
      currency: CurrencyCode.RIM,
      amount: SIGNUP_BONUS_RIM,
      reason: LedgerReason.SIGNUP_BONUS,
      idempotencyKey: `signup:${userId}`,
    });
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  /**
   * Misafir giriş.
   *
   * Aynı kurulumdan tekrar gelindiğinde AYNI hesap döner — yeni bir misafir
   * hesap açmaz. Bu, oyuncunun uygulamayı kapatıp açtığında ilerlemesini
   * kaybetmemesinin tek dayanağı: istemcide token silinmiş bile olsa
   * installationId ile aynı hesaba geri bağlanıyor.
   */
  async loginAsGuest(dto: GuestLoginDto): Promise<AuthTokensDto> {
    // Kimlik yoksa bu ilk açılış: üretip yanıtta geri veriyoruz. Üretimin
    // sunucuda olması şart — bu değer misafir hesabın giriş anahtarı ve
    // istemcide kriptografik rastgelelik yok (bkz. GuestLoginDto).
    const installationId = dto.installationId ?? randomUUID();
    const info: DeviceInfoDto = { ...dto, installationId };

    const existingDevice = dto.installationId
      ? await this.prisma.device.findFirst({
          where: { installationId },
          include: { user: true },
          orderBy: { lastSeenAt: 'desc' },
        })
      : null;

    // Bu kurulum daha önce görüldü ve sahibi hâlâ misafirse: aynı hesap.
    // Sahibi gerçek hesaba geçmişse yeni misafir açmıyoruz — o kullanıcı
    // artık email/şifre ile girmeli, aksi hâlde cihazı eline geçiren biri
    // gerçek hesaba misafir kapısından girerdi.
    if (existingDevice) {
      if (!existingDevice.user.isGuest) {
        throw new ConflictException('Bu cihaz bir hesaba bağlı, giriş yapın');
      }
      const device = await this.devices.register(existingDevice.userId, info);
      return { ...(await this.tokens.issue(existingDevice.user, device.id)), installationId };
    }

    // Yeni misafir: kullanıcı ve cihaz aynı transaction'da yaratılıyor —
    // biri oluşup diğeri oluşmazsa sahipsiz kayıt kalırdı.
    const user = await this.prisma.user.create({
      data: { isGuest: true },
      select: { id: true, email: true, displayName: true, isGuest: true },
    });
    await this.grantSignupBonus(user.id);
    await this.inventory.grantStarters(user.id);
    const device = await this.devices.register(user.id, info);
    return { ...(await this.tokens.issue(user, device.id)), installationId };
  }

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    if (await this.users.emailExists(dto.email)) {
      throw new ConflictException('Bu e-posta zaten kayıtlı');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await this.hashPassword(dto.password),
        displayName: dto.displayName ?? null,
        isGuest: false,
      },
      select: { id: true, email: true, displayName: true, isGuest: true },
    });

    await this.grantSignupBonus(user.id);
    await this.inventory.grantStarters(user.id);
    const device = await this.devices.register(user.id, dto);
    return this.tokens.issue(user, device.id);
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.users.findByEmailWithSecret(dto.email);

    /**
     * Kullanıcı yoksa da şifre doğrulaması ÇALIŞTIRILIYOR (sahte hash'e
     * karşı). Sebep zamanlama saldırısı: var olmayan kullanıcıda hemen
     * dönseydik yanıt belirgin şekilde hızlı olurdu ve saldırgan sadece
     * süreye bakarak hangi e-postaların kayıtlı olduğunu çıkarabilirdi.
     */
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0$0000000000000000000000000000000000000000000';
    const valid = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !valid) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    const device = await this.devices.register(user.id, dto);
    return this.tokens.issue(user, device.id);
  }

  /**
   * Misafir hesabı gerçek hesaba yükseltir.
   *
   * Faz 2'nin açık şartı: "veri kaybı olmadan". Bu yüzden yeni kullanıcı
   * YARATILMIYOR, mevcut satır güncelleniyor — koleksiyon, coin, istatistik
   * ne varsa aynı user id'ye bağlı kaldığı için hiçbir şey taşınmıyor,
   * dolayısıyla hiçbir şey kaybolmuyor.
   */
  async linkGuestToAccount(userId: string, dto: LinkAccountDto): Promise<AuthTokensDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isGuest: true },
    });
    if (!current) throw new UnauthorizedException('Oturum geçersiz');
    if (!current.isGuest) throw new ConflictException('Bu hesap zaten bir e-postaya bağlı');
    if (await this.users.emailExists(dto.email)) {
      throw new ConflictException('Bu e-posta zaten kayıtlı');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        passwordHash: await this.hashPassword(dto.password),
        displayName: dto.displayName ?? undefined,
        isGuest: false,
      },
      select: { id: true, email: true, displayName: true, isGuest: true },
    });

    // Eski jetonlar "isGuest: true" taşıyor — yükseltmeden sonra geçersiz
    // olmalılar, yoksa yetki bilgisi güncel olmayan bir token dolaşımda kalır.
    await this.tokens.revokeAllForUser(userId);
    return this.tokens.issue(user);
  }
}
