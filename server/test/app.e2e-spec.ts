import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { SIGNUP_BONUS_RIM } from '../src/modules/economy/reward.rules.js';

/**
 * Açılış duman testi (smoke test).
 *
 * Kapsamı bilerek dar: her uç noktayı tek tek sınamıyor, yeni bir oyuncunun
 * uygulamayı ilk açtığında yaptığı zinciri baştan sona bir kez geçiyor —
 * misafir giriş, cüzdan, koleksiyon. Bu zincir kopmuşsa oyun hiç açılmıyor
 * demektir, yani CI'da kırmızı görmesi gereken ilk şey bu.
 *
 * Bu test GERÇEK Postgres ve Redis ister (`docker compose up -d`). Sahte
 * (mock) veritabanıyla çalıştırmak, e2e'nin cevap vermesi gereken tek soruyu
 * —"parçalar birbirine bağlanıyor mu"— sormadan geçmek olurdu.
 */
describe('Açılış zinciri (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // configureApp: testin üretimdekiyle AYNI uygulamayı sınaması için
    // (global önek, doğrulama borusu, hata filtresi). Bkz. src/bootstrap.ts.
    app = configureApp(moduleFixture.createNestApplication()) as INestApplication<App>;
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health — token istemeden bağımlılıkların durumunu söyler', async () => {
    const res = await request(server).get('/api/health').expect(200);

    // Üçünün de ayakta olması bekleniyor: bu test zaten gerçek Postgres ve
    // Redis ile koşuyor. Biri düşükse "degraded" gelir ve test kırılır —
    // istenen de bu, çünkü o durumda sunucu gerçekten iş göremez durumdadır.
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies).toEqual({ database: true, redis: true, queue: true });
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('GET /api/economy/wallet — token yoksa 401', async () => {
    // Guard'ın global ve "varsayılan kapalı" olduğunun kanıtı. Bu test
    // geçmezse birileri korumayı yanlışlıkla gevşetmiş demektir.
    await request(server).get('/api/economy/wallet').expect(401);
  });

  describe('yeni misafir oyuncu', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/auth/guest')
        .send({ platform: 'IOS', appVersion: '0.0.0-e2e' })
        .expect(200);

      accessToken = res.body.accessToken;
      expect(res.body.user.isGuest).toBe(true);
      // Kurulum kimliğini sunucu üretiyor (ADR 0011, Karar 3).
      expect(res.body.installationId).toBeTruthy();
    });

    it('300 jant ve 0 coin ile başlar', async () => {
      const res = await request(server)
        .get('/api/economy/wallet')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const rim = res.body.find((b: { currency: string }) => b.currency === 'RIM');
      const coin = res.body.find((b: { currency: string }) => b.currency === 'COIN');

      expect(rim.balance).toBe(SIGNUP_BONUS_RIM);
      // Coin sadece gerçek parayla alınır; yeni hesapta olması modelin
      // bozulduğu anlamına gelir (ADR 0008).
      expect(coin.balance).toBe(0);
    });

    it('başlangıç kartları koleksiyonuna yazılmıştır', async () => {
      const res = await request(server)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const vehicles = res.body.filter((c: { kind: string }) => c.kind === 'VEHICLE');
      const support = res.body.filter((c: { kind: string }) => c.kind === 'SUPPORT');

      // Kesin sayı yazılmadı: başlangıç kadrosu bir denge kararı ve
      // değişecek. Testin koruduğu şey sayı değil, "yeni oyuncu boş
      // koleksiyonla kalmaz" kuralı — boş koleksiyon maça girilemez demek.
      expect(vehicles.length).toBeGreaterThan(0);
      expect(support.length).toBeGreaterThan(0);
    });

    it('parası yetmeyen kart açılamaz', async () => {
      // Sunucunun fiyatı kendi bildiğinin ve bakiyeyi kontrol ettiğinin
      // kanıtı. İstemci fiyat göndermiyor, dolayısıyla "ucuza aldım"
      // diyemiyor; tek savunma sunucunun bu reddi.
      const res = await request(server)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${accessToken}`);
      const owned = new Set(res.body.map((c: { cardId: string }) => c.cardId));

      const expensive = await request(server)
        .post('/api/inventory/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ cardId: 'apex-meridian', currency: 'RIM' });

      // 300 jant hiçbir kilitli kartı karşılamıyor: ya "yetersiz bakiye"
      // (400) ya da kart zaten sahipse "zaten var" (409) beklenir.
      expect([400, 409]).toContain(expensive.status);
      expect(owned.has('apex-meridian')).toBe(false);
    });
  });
});
