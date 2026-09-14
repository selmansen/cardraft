import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { CacheService } from '../src/infrastructure/cache/cache.service.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';

/**
 * Sağlayıcı girişi ve hesap silme.
 *
 * Jetonlar sahte doğrulayıcıdan geçiyor (`sahte:<subject>:<email>`): Apple ve
 * Google geliştirici hesapları henüz yok, ama doğrulanacak şey burada
 * imzanın geçerliliği değil — kimliğin doğru kullanıcıya BAĞLANMASI. O mantık
 * gerçek jetonlarla da birebir aynı çalışacak.
 */
describe('Sağlayıcı girişi (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let cache: CacheService;

  const device = (n: string) => ({ installationId: `e2e-${n}-${Date.now()}`, platform: 'IOS' });
  const created: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleFixture.createNestApplication()) as INestApplication<App>;
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    cache = app.get(CacheService);
    await clearRateCounters();
  });

  afterAll(async () => {
    if (created.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created } } });
    }
    await app.close();
  });

  /** Sınır açık kalmalı (kapatmak başka bir uygulamayı test etmek olurdu) ama
   *  sayaç Redis'te birikiyor; koşular arası temizleniyor. */
  async function clearRateCounters(): Promise<void> {
    const keys = await cache.raw.keys('rl:*');
    if (keys.length > 0) await cache.raw.del(...keys);
  }

  async function guest() {
    const res = await request(server).post('/api/auth/guest').send(device('g')).expect(200);
    created.push(res.body.user.id);
    return res.body as { accessToken: string; user: { id: string; isGuest: boolean } };
  }

  it('misafir hesap Apple ile bağlanınca AYNI hesap kalıyor', async () => {
    const before = await guest();
    expect(before.user.isGuest).toBe(true);

    const res = await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${before.accessToken}`)
      .send({ provider: 'APPLE', idToken: `sahte:apple-${Date.now()}:a@example.com`, ...device('g') })
      .expect(200);

    // ADR 0005'in sözü: yükseltme aynı satırda olur, ilerleme taşınmaz.
    expect(res.body.user.id).toBe(before.user.id);
    expect(res.body.user.isGuest).toBe(false);
    expect(res.body.user.email).toBe('a@example.com');
  });

  it('aynı sağlayıcı hesabıyla yeni cihazdan gelince eski hesaba dönülüyor', async () => {
    const subject = `apple-tasima-${Date.now()}`;
    const first = await guest();
    await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ provider: 'APPLE', idToken: `sahte:${subject}`, ...device('c1') })
      .expect(200);

    // Yeni telefon: taze misafir hesap, sonra aynı Apple hesabıyla giriş.
    const second = await guest();
    const res = await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send({ provider: 'APPLE', idToken: `sahte:${subject}`, ...device('c2') })
      .expect(200);

    // Kurtarmanın tamamı bu satır: yeni cihazdaki boş hesap değil, eskisi.
    expect(res.body.user.id).toBe(first.user.id);
  });

  it('misafirin cüzdanı 0, giriş yapınca hoş geldin hediyesi geliyor', async () => {
    const user = await guest();

    // Misafirlik bir deneme: oynanabiliyor ama hiçbir şey birikmiyor.
    const before = await request(server)
      .get('/api/economy/wallet')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(before.body.find((b: { currency: string }) => b.currency === 'RIM')?.balance ?? 0).toBe(0);

    const linked = await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ provider: 'GOOGLE', idToken: `sahte:hediye-${Date.now()}`, ...device('h') })
      .expect(200);

    const after = await request(server)
      .get('/api/economy/wallet')
      .set('Authorization', `Bearer ${linked.body.accessToken}`)
      .expect(200);
    // Hediye ilk paketi tam karşılıyor — "paketler aç" vaadi giriş biter
    // bitmez kullanılabilir olmalı.
    expect(after.body.find((b: { currency: string }) => b.currency === 'RIM').balance).toBe(350);
  });

  it('misafir paket açamıyor ve kart alamıyor', async () => {
    const user = await guest();
    const auth = `Bearer ${user.accessToken}`;

    // Arayüzde düğmeyi gizlemek görgü kuralı, koruma değil: uçlar doğrudan
    // çağrılabilir. Mesaj da "yetersiz bakiye" değil — o yanlış sebebi söyler
    // ve oyuncuyu jant aramaya iter, oysa yapması gereken giriş yapmak.
    const pack = await request(server)
      .post('/api/store/packs/basic/open')
      .set('Authorization', auth)
      .send({ requestId: crypto.randomUUID() })
      .expect(403);
    expect(pack.body.message).toContain('giriş yapman');

    await request(server)
      .post('/api/inventory/unlock')
      .set('Authorization', auth)
      .send({ cardId: 'nocturne-coupe', currency: 'RIM' })
      .expect(403);
  });

  it('ikinci sağlayıcı bağlanınca hediye tekrar verilmiyor', async () => {
    const user = await guest();
    let auth = `Bearer ${user.accessToken}`;
    const first = await request(server)
      .post('/api/auth/identity')
      .set('Authorization', auth)
      .send({ provider: 'APPLE', idToken: `sahte:ilk-${Date.now()}`, ...device('i') })
      .expect(200);

    auth = `Bearer ${first.body.accessToken}`;
    await request(server)
      .post('/api/auth/identity')
      .set('Authorization', auth)
      .send({ provider: 'GOOGLE', idToken: `sahte:ikinci-${Date.now()}`, ...device('i') })
      .expect(200);

    const wallet = await request(server).get('/api/economy/wallet').set('Authorization', auth).expect(200);
    expect(wallet.body.find((b: { currency: string }) => b.currency === 'RIM').balance).toBe(350);
  });

  it('bağlı hesap doğrulamasız silinemiyor', async () => {
    const subject = `apple-silme-${Date.now()}`;
    const user = await guest();
    const linked = await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ provider: 'APPLE', idToken: `sahte:${subject}`, ...device('s') })
      .expect(200);
    const auth = `Bearer ${linked.body.accessToken}`;

    // Silme geri alınamaz ve access token 15 dakika yaşıyor: telefonu kısa
    // süreliğine eline geçiren biri hesabı silememeli.
    await request(server).delete('/api/auth/account').set('Authorization', auth).send({}).expect(400);

    // Başka birinin kimliğiyle de silinemiyor.
    await request(server)
      .delete('/api/auth/account')
      .set('Authorization', auth)
      .send({ provider: 'APPLE', idToken: `sahte:baskasi-${Date.now()}` })
      .expect(400);

    await request(server)
      .delete('/api/auth/account')
      .set('Authorization', auth)
      .send({ provider: 'APPLE', idToken: `sahte:${subject}` })
      .expect(204);

    // Apple App Store silmeyi şart koşuyor ve silmenin gerçek olması gerekiyor.
    expect(await prisma.user.findUnique({ where: { id: user.user.id } })).toBeNull();
    expect(await prisma.wallet.count({ where: { userId: user.user.id } })).toBe(0);
    expect(await prisma.ownedCard.count({ where: { userId: user.user.id } })).toBe(0);
  });

  it('misafir hesap doğrulamasız silinebiliyor', async () => {
    // Misafirde kimlik yok, doğrulanacak bir şey de yok; onay istemcideki
    // açık uyarıyla alınıyor.
    const user = await guest();
    await request(server)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({})
      .expect(204);
    expect(await prisma.user.findUnique({ where: { id: user.user.id } })).toBeNull();
  });
});
