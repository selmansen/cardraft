import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('durum, sürüm ve ayakta kalma süresi döner', () => {
      const health = appController.health();

      expect(health.status).toBe('ok');
      // Sürüm package.json'dan okunuyor; sabit bir değere bağlamak testi her
      // yayında kırardı. Doğrulanan şey biçim: "0.1.0" gibi bir semver.
      expect(health.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});
