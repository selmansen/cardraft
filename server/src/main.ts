import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { TypedConfigService } from './config/app-config.module.js';
import { setupSwagger } from './swagger.js';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const config = app.get(TypedConfigService);

  // Swagger main.ts'te, configureApp'te değil: testlerin belge arayüzüne
  // ihtiyacı yok ve her e2e koşusunda şema üretmek boşuna iş olurdu.
  setupSwagger(app, config.isProduction);

  // Kapatma sinyallerinde onModuleDestroy kancaları çalışsın: açık DB/Redis
  // bağlantıları ve işlenmekte olan kuyruk işleri düzgün kapansın.
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API hazır: http://localhost:${port}/api`, 'Bootstrap');
  if (!config.isProduction) {
    Logger.log(`Belge: http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

await bootstrap();
