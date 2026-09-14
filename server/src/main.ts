import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TypedConfigService } from './config/app-config.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(TypedConfigService);

  /**
   * Doğrulama boru hattı — tek yerde, global.
   *
   * Her controller'da tek tek kurmak yerine burada tanımlanıyor: bir uç
   * noktanın doğrulamayı "unutması" imkânsız hale geliyor. Ayarların gerekçesi:
   * - whitelist: DTO'da tanımlı olmayan alanlar sessizce ATILIR. İstemcinin
   *   `{"coins": 999999}` gibi fazladan alan gönderip beklenmedik bir yere
   *   sızmasını engelleyen ilk savunma hattı.
   * - forbidNonWhitelisted: sadece atmakla kalmaz, hata döner — istemci
   *   hatasını sessizce yutmak yerine erken söyler.
   * - transform: gelen JSON'u DTO sınıfına dönüştürür, böylece @Type ile
   *   yazdığımız sayı/tarih dönüşümleri gerçekten çalışır.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Tek tip hata gövdesi + beklenmeyen hataların istemciye sızmaması.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Sürümleme değil ama ileride /v1 gibi bir önek gerekirse tek yer burası.
  app.setGlobalPrefix('api');

  // Mobil istemci farklı origin'den gelecek.
  app.enableCors({ origin: true, credentials: true });

  // Kapatma sinyallerinde onModuleDestroy kancaları çalışsın: açık DB/Redis
  // bağlantıları ve işlenmekte olan kuyruk işleri düzgün kapansın.
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API hazır: http://localhost:${port}/api`, 'Bootstrap');
}

await bootstrap();
