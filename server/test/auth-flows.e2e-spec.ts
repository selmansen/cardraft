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

  it('ilerlemesi olan misafir, başkasının hesabına sessizce geçemiyor', async () => {
    const subject = `google-cakisma-${Date.now()}`;
    const owner = await guest();
    await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ provider: 'GOOGLE', idToken: `sahte:${subject}`, ...device('o') })
      .expect(200);

    const other = await guest();
    // Bu misafirin ilerlemesi var: onaysız geçiş saatlerini silmek olurdu.
    await prisma.ownedCard.create({
      data: { userId: other.user.id, cardId: 'apex-meridian', kind: 'VEHICLE', source: 'PURCHASE' },
    });

    await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ provider: 'GOOGLE', idToken: `sahte:${subject}`, ...device('x') })
      .expect(409);

    // Onay verilince geçiş yapılıyor.
    const forced = await request(server)
      .post('/api/auth/identity')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ provider: 'GOOGLE', idToken: `sahte:${subject}`, force: true, ...device('x') })
      .expect(200);
    expect(forced.body.user.id).toBe(owner.user.id);
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
