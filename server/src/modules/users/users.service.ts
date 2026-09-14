import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { IdentityProvider } from '../../generated/prisma/enums.js';

/** Dışarı verilebilir kullanıcı gösterimi — passwordHash burada YOK. */
export interface PublicUser {
  id: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  createdAt: Date;
  /**
   * Hesaba bağlı giriş yolları.
   *
   * İstemci bunu bilmek ZORUNDA: hesap silme sağlayıcıdan taze bir jeton
   * istiyor ve istemcinin hangi sağlayıcıyı çağıracağını bilmesi gerekiyor.
   * Olmadan tahmin etmek zorunda kalırdı.
   */
  providers: IdentityProvider[];
}

/**
 * Kullanıcı okuma/yazma işlemleri.
 *
 * `select` her sorguda AÇIKÇA yazılıyor, `passwordHash` hiçbirinde yok.
 * Alternatif "çek sonra sil" yaklaşımı (`delete user.passwordHash`) tek bir
 * unutulan yerde hash'i dışarı sızdırır; select ile alan zaten hiç
 * gelmediğinden sızdıracak bir şey olmuyor. Güvenliği "hatırlamaya" değil
 * varsayılana bağlamak.
 */
@Injectable()
export class UsersService {
  /** Tekrarlanan select bloğu tek yerde. */
  private static readonly publicFields = {
    id: true,
    email: true,
    displayName: true,
    isGuest: true,
    createdAt: true,
    identities: { select: { provider: true } },
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: UsersService.publicFields,
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const { identities, ...rest } = user;
    return { ...rest, providers: identities.map((i) => i.provider) };
  }

  /** Şifre doğrulaması için — hash'i AÇIKÇA isteyen tek metot. */
  async findByEmailWithSecret(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...UsersService.publicFields, passwordHash: true },
    });
  }

  async emailExists(email: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return found !== null;
  }
}
