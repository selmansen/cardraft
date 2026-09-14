import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ACCOUNT_REQUIRED_KEY } from '../decorators/account-required.decorator.js';

/**
 * Bağlı hesap şartı — misafir oyuncu harcayamaz ve kazanamaz.
 *
 * Misafirlik bir DENEME: oyuncu maça girer, oynar, öğrenir; ama cüzdanı 0 ve
 * koleksiyonu başlangıç kartlarından ibaret kalır. İlerlemenin tamamı hesaba
 * bağlı.
 *
 * KURAL NEDEN SUNUCUDA: arayüzde düğmeyi gizlemek bir görgü kuralı, koruma
 * değil. İstemci düzenlenebilir; paket açma ve kart alma uçları doğrudan
 * çağrılabilir. Misafirin bakiyesi zaten 0 olduğu için "yetersiz bakiye" de
 * dönerdi — ama o mesaj yanlış sebebi söyler ve oyuncuyu jant aramaya iter,
 * oysa yapması gereken giriş yapmak.
 */
@Injectable()
export class AccountRequiredGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(ACCOUNT_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>();
    const userId = request.user?.sub;
    if (!userId) return true; // Kimlik guard'ı zaten reddedecek.

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true },
    });

    if (user?.isGuest) {
      throw new ForbiddenException(
        'Bu özellik için giriş yapman gerekiyor. Apple ya da Google hesabınla tek dokunuşta bağlanabilirsin.',
      );
    }
    return true;
  }
}
