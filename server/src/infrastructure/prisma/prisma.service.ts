import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { TypedConfigService } from '../../config/app-config.module.js';
// Üretilen istemci artık node_modules'ta değil, projenin içinde
// (src/generated/prisma) — bkz. prisma/schema/schema.prisma'daki generator.
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Uygulamanın tek Prisma istemcisi.
 *
 * Neden servis olarak sarmalıyoruz da her yerde `new PrismaClient()`
 * demiyoruz: PrismaClient bir bağlantı havuzu tutar. Her modül kendi
 * istemcisini yaratsaydı havuz sayısı modül sayısı kadar olurdu ve Postgres'in
 * bağlantı limiti kısa sürede dolardı. NestJS'in DI konteyneri bunu doğal
 * olarak çözüyor: tek örnek (singleton) yaratılıp ihtiyacı olana enjekte
 * ediliyor.
 *
 * Prisma 7 ile bağlantı, "driver adapter" üzerinden veriliyor (burada
 * node-postgres). Bu, Prisma'nın kendi Rust motoru yerine standart bir Node
 * sürücüsü kullanması demek — sürücüyü ileride değiştirebilmek (örn. serverless
 * bir Postgres'e geçmek) tek satırlık bir iş oluyor.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: TypedConfigService) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL') }),
    });
  }

  async onModuleInit(): Promise<void> {
    // Bağlantıyı ilk istek beklemeden kur: ilk kullanıcının isteği bağlantı
    // kurulumunu beklemesin, ve yanlış DATABASE_URL açılışta fark edilsin.
    await this.$connect();
    this.logger.log('Veritabanı bağlantısı kuruldu');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
