import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { TypedConfigService } from './config/app-config.module.js';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const config = app.get(TypedConfigService);

  // Kapatma sinyallerinde onModuleDestroy kancaları çalışsın: açık DB/Redis
  // bağlantıları ve işlenmekte olan kuyruk işleri düzgün kapansın.
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API hazır: http://localhost:${port}/api`, 'Bootstrap');
}

await bootstrap();
