import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * @Global: veritabanı erişimi neredeyse her modülün ihtiyacı. Global olmasa
 * her modülün `imports: [PrismaModule]` yazması gerekirdi — tekrar eden,
 * hiçbir bilgi taşımayan satırlar. Global işaretlemeyi sadece gerçekten
 * çapraz kesen altyapı için kullanıyoruz (prisma, cache, config); iş
 * modülleri asla global olmayacak, çünkü kimin kime bağımlı olduğunu
 * görebilmek mimarinin kendisi.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
