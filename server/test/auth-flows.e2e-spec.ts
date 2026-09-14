import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { AuthTokenService } from '../src/modules/auth/auth-token.service.js';
import { CacheService } from '../src/infrastructure/cache/cache.service.js';
import { TokenPurpose } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';

/**
 * Hesap akışları: doğrulama, şifre sıfırlama, şifre değiştirme, hesap silme.
 *
 * Jetonlar e-postayla gidiyor ve testin e-posta kutusu yok. Loga bakmak
 * kırılgan olurdu (biçim değişince test kırılır, üstelik sebebi anlaşılmaz),
 * o yüzden jeton veritabanından okunmuyor da — ÜRETİLİRKEN yakalanıyor:
 * `AuthTokenService.issue` sarmalanıp düz jeton kaydediliyor. Test, üretimde
 * çalışan kodun aynısını çalıştırıyor, sadece sonucu da görüyor.
 */
describe('Hesap akışları (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let cache: CacheService;

  /** En son üretilen düz jeton, amacına göre. */
  const issued = new Map<TokenPurpose, string>();

  const email = `e2e-${Date.now()}@example.com`;
  const device = { installationId: `e2e-${Date.now()}`, platform: 'IOS' };
  const FIRST = 'ilk-sifre-1234';
  const SECOND = 'ikinci-sifre-5678';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication()) as INestApplication<App>;

    const tokens = app.get(AuthTokenService);
    const original = tokens.issue.bind(tokens);
    tokens.issue = async (userId: string, purpose: TokenPurpose) => {
      const token = await original(userId, purpose);
      issued.set(purpose, token);
      return token;
    };

    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    cache = app.get(CacheService);

    /**
     * Hız sayaçları temizleniyor.
     *
     * Sınır açık kalmalı — kapatmak, üretimde çalışan uygulamadan başka bir
     * uygulamayı test etmek olurdu. Ama sayaç Redis'te ve testler arka arkaya
     * koşuyor: bir önceki koşunun sayacı bu koşuyu 429'a düşürüyordu. Sınırın
     * gerçekten ısırdığı aşağıda ayrıca sınanıyor.
     */
    await clearRateCounters();
  });

  async function clearRateCounters(): Promise<void> {
    const keys = await cache.raw.keys('rl:*');
    if (keys.length > 0) await cache.raw.del(...keys);
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('kayıt olan oyuncu doğrulanmamış başlıyor ama oynayabiliyor', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ email, password: FIRST, displayName: 'E2E', ...device })
      .expect(201);

    expect(res.body.user.isGuest).toBe(false);

    // Doğrulama oyuna girişi engellemiyor: korumalı uç hemen çalışıyor.
    await request(server)
      .get('/api/economy/wallet')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);

    const user = await prisma.user.findUnique({ where: { email }, select: { emailVerifiedAt: true } });
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it('doğrulanmamış adrese şifre sıfırlama gönderilmiyor', async () => {
    issued.delete(TokenPurpose.PASSWORD_RESET);
    // 204 dönüyor ama jeton ÜRETİLMİYOR: doğrulanmamış adrese sıfırlama
    // bağlantısı yollamak, adresi yanlış yazan kişinin hesabını o adresin
    // sahibine vermek olurdu.
    await request(server).post('/api/auth/password/forgot').send({ email }).expect(204);
    expect(issued.get(TokenPurpose.PASSWORD_RESET)).toBeUndefined();
  });

  it('e-posta doğrulanıyor ve jeton tek kullanımlık', async () => {
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email, password: FIRST, ...device })
      .expect(200);

    await request(server)
      .post('/api/auth/email/verify/send')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(204);

    const token = issued.get(TokenPurpose.EMAIL_VERIFICATION);
    expect(token).toBeTruthy();

    await request(server).post('/api/auth/email/verify').send({ token }).expect(204);
    // İkinci kez: aynı bağlantı bir daha çalışmamalı.
    await request(server).post('/api/auth/email/verify').send({ token }).expect(400);
  });

  it('olmayan adres için de 204 dönüyor (hesap sayımı engelleniyor)', async () => {
    // Farklı cevap vermek, adresleri tek tek deneyerek hangilerinin kayıtlı
    // olduğunu öğrenmeye yarardı.
    await request(server)
      .post('/api/auth/password/forgot')
      .send({ email: `yok-${Date.now()}@example.com` })
      .expect(204);
  });

  it('şifre sıfırlanıyor ve açık oturumlar kapanıyor', async () => {
    await clearRateCounters();
    const before = await request(server)
      .post('/api/auth/login')
      .send({ email, password: FIRST, ...device })
      .expect(200);

    await request(server).post('/api/auth/password/forgot').send({ email }).expect(204);
    const token = issued.get(TokenPurpose.PASSWORD_RESET);
    expect(token).toBeTruthy();

    await request(server)
      .post('/api/auth/password/reset')
      .send({ token, password: SECOND })
      .expect(204);

    // Sıfırlamanın en yaygın sebebi "hesabıma başkası giriyor". Açık oturum
    // bırakılsaydı o kişi içeride kalırdı.
    await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: before.body.refreshToken })
      .expect(401);

    await request(server).post('/api/auth/login').send({ email, password: FIRST, ...device }).expect(401);
    await request(server).post('/api/auth/login').send({ email, password: SECOND, ...device }).expect(200);
  });

  it('şifremi unuttum hız sınırına takılıyor', async () => {
    // Sınır olmadan bu uç, hangi adreslerin kayıtlı olduğunu taramak için
    // kullanılabilirdi; kaba kuvvete açık giriş ucu için de aynısı geçerli.
    await clearRateCounters();
    const spam = `spam-${Date.now()}@example.com`;
    for (let i = 0; i < 5; i++) {
      await request(server).post('/api/auth/password/forgot').send({ email: spam }).expect(204);
    }
    await request(server).post('/api/auth/password/forgot').send({ email: spam }).expect(429);
    await clearRateCounters();
  });

  it('hesap siliniyor ve verisi kalmıyor', async () => {
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email, password: SECOND, ...device })
      .expect(200);
    const auth = `Bearer ${login.body.accessToken}`;
    const userId = login.body.user.id;

    // Şifre olmadan silme reddediliyor.
    await request(server).delete('/api/auth/account').set('Authorization', auth).send({}).expect(400);

    await request(server)
      .delete('/api/auth/account')
      .set('Authorization', auth)
      .send({ password: SECOND })
      .expect(204);

    // Apple App Store silmeyi şart koşuyor ve silmenin GERÇEK olması gerekiyor:
    // bağlı veriler cascade ile gidiyor.
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.wallet.count({ where: { userId } })).toBe(0);
    expect(await prisma.ownedCard.count({ where: { userId } })).toBe(0);
  });
});
