import { ValidationPipe, type INestApplication } from '@nestjs/common';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

/**
 * Uygulamanın global kurulumu — bilerek `main.ts`'ten ayrı bir dosyada.
 *
 * Sebebi testler: e2e testi `Test.createTestingModule` ile kendi uygulamasını
 * kuruyor ve `main.ts`'i hiç çalıştırmıyor. Bu ayar orada tekrar edilmezse
 * test, üretimde çalışandan BAŞKA bir uygulamayı sınar — doğrulama borusu
 * olmadan, `/api` öneki olmadan. Yani "testler geçiyor ama canlıda 404"
 * sınıfından hatalar. Tek fonksiyon olunca ikisi de aynı uygulamayı kuruyor.
 */
export function configureApp(app: INestApplication): INestApplication {
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

  return app;
}
