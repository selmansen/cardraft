#!/usr/bin/env node
/**
 * Postman koleksiyonunu üretir: docs/api/CarDraft.postman_collection.json
 *
 * Neden koleksiyon OpenAPI'den türetilmiyor:
 *   OpenAPI şeması API'nin YÜZEYİNİ anlatır — hangi yol, hangi alan, hangi
 *   tip. Koleksiyonun değerli olan kısmı ise yüzey değil AKIŞ: hangi isteği
 *   önce göndereceğin, token'ın kendiliğinden yakalanması, gerçekten çalışan
 *   örnek gövdeler. Şemadan otomatik üretilen bir koleksiyon bunların hiçbirine
 *   sahip olmaz; elle düzeltilirse de ilk yeniden üretimde kaybolur.
 *
 * Neden JSON elle düzenlenmiyor:
 *   Koleksiyon 1000 satırın üzerinde ve yapısı tekrar eden bir kalıp. Bu
 *   dosyada bir istek 10 satır; JSON'da aynısı 40 satır ve elle düzenlenirken
 *   bozulması çok kolay.
 *
 * Kapsamın şemayla aynı kaldığını `scripts/check-api-docs.mjs` doğruluyor
 * (CI'da koşuyor). Yani bu dosya güncellenmezse CI kırılır.
 *
 * Çalıştırmak için: npm run postman
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'api');

const saveTokens = `const json = pm.response.json();
pm.collectionVariables.set('accessToken', json.accessToken);
pm.collectionVariables.set('refreshToken', json.refreshToken);
if (json.installationId) {
  pm.collectionVariables.set('installationId', json.installationId);
}
pm.test('Oturum açıldı', () => {
  pm.expect(json.accessToken, 'accessToken').to.be.a('string');
});`;

const status = (code, label) =>
  Array.isArray(code)
    ? `pm.test(${JSON.stringify(label)}, () => pm.expect(pm.response.code).to.be.oneOf(${JSON.stringify(code)}));`
    : `pm.test('${code} döndü', () => pm.response.to.have.status(${code}));`;

/** Tek bir isteği Postman biçimine çevirir. */
function req({ name, method, path, body, query, auth, desc, test, status: code = 200, statusLabel }) {
  const raw = `{{baseUrl}}${path}${query ? '?' + query.map((q) => `${q.key}=${q.value}`).join('&') : ''}`;
  const item = {
    name,
    request: {
      method,
      header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: {
        raw,
        host: ['{{baseUrl}}'],
        path: path.replace(/^\//, '').split('/'),
        ...(query ? { query } : {}),
      },
      description: desc,
    },
    response: [],
  };
  if (body) item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  // Kimlik doğrulaması gerekmeyen uçlar: koleksiyon seviyesindeki Bearer'ı kapat.
  if (auth === 'none') item.request.auth = { type: 'noauth' };
  const script = [test, status(code, statusLabel)].filter(Boolean).join('\n\n');
  item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: script.split('\n') } }];
  return item;
}

const device = { installationId: '{{installationId}}', platform: 'IOS', appVersion: '0.1.0' };

const collection = {
  info: {
    _postman_id: 'cardraft-api-v1',
    name: 'CarDraft API',
    description: `CarDraft oyun sunucusunun tüm uç noktaları.

**Başlarken:** \`Kimlik → Misafir giriş (yeni kurulum)\` isteğini çalıştır. Dönen
token'lar otomatik olarak koleksiyon değişkenlerine yazılır ve diğer bütün
istekler onları kullanır — elle kopyalaman gereken hiçbir şey yok.

Sunucunun çalışıyor olması gerekir:
\`\`\`
cd server && docker compose up -d && npm run start:dev
\`\`\`

Ayrıntı: \`docs/api/README.md\`. Kararların gerekçeleri: \`server/docs/adr/\`.`,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  // Koleksiyon seviyesinde Bearer: her isteğe tek tek eklemek yerine bir kez.
  // Public uçlar kendi içinde "noauth" ile bunu kapatıyor.
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000/api', type: 'string' },
    { key: 'accessToken', value: '', type: 'string' },
    { key: 'refreshToken', value: '', type: 'string' },
    { key: 'installationId', value: '', type: 'string' },
    { key: 'matchId', value: '', type: 'string' },
    { key: 'packId', value: 'basic', type: 'string' },
    { key: 'deviceId', value: '', type: 'string' },
  ],
  item: [
    {
      name: 'Sistem',
      description: 'Kimlik doğrulaması istemeyen uçlar.',
      item: [
        req({
          name: 'Sağlık kontrolü',
          method: 'GET',
          path: '/health',
          auth: 'none',
          desc: `Sunucunun durumu, çalışan sürüm, ayakta kalma süresi ve **üç altyapı bağımlılığının** (Postgres, Redis, kuyruk) gerçekten ayakta olup olmadığı.

Boş bir "200 OK" neden yetmiyor: uygulama ayakta ama veritabanı düşmüşse yine 200 döner ve izleme sistemi her şeyin yolunda sandığı için kimse haberdar olmaz. Bağımlılıklardan biri cevap vermiyorsa \`status\` **degraded** olur.

Bilerek public: bunu çağıran şey bir oyuncu değil, CI ve yük dengeleyici. Token isteyen bir sağlık kontrolü, dengeleyicinin sağlıklı sunucuyu ölü sanmasına yol açardı.`,
          test: `const json = pm.response.json();
pm.test('Sunucu ve bağımlılıkları ayakta', () => {
  pm.expect(json.status).to.eql('ok');
  pm.expect(json.dependencies).to.deep.equal({ database: true, redis: true, queue: true });
});
pm.test('Sürüm bildiriliyor', () => pm.expect(json.version).to.match(/^\\d+\\.\\d+\\.\\d+/));`,
        }),
      ],
    },
    {
      name: 'Kimlik',
      description: `Oyuna giriş. Oyuncu hesabını e-posta ile açmak zorunda değil: uygulama ilk açılışta sessizce **misafir** hesabı yaratıyor, ilerleme oraya yazılıyor, oyuncu isterse sonra e-posta bağlıyor (aynı hesap, aynı ilerleme).`,
      item: [
        req({
          name: 'Misafir giriş (yeni kurulum)',
          method: 'POST',
          path: '/auth/guest',
          auth: 'none',
          body: { platform: 'IOS', appVersion: '0.1.0' },
          desc: `**Buradan başla.** Yeni bir misafir hesap açar; dönen token'lar ve \`installationId\` otomatik olarak koleksiyon değişkenlerine yazılır.

\`installationId\` gönderilmiyor çünkü onu **sunucu üretiyor**: bu alan misafir hesabın fiili giriş anahtarı, yani tahmin edilemez olmak zorunda. React Native tarafında güvenilir rastgelelik yok (\`crypto.getRandomValues\` yok, \`Math.random\` bir kimlik anahtarı için uygun değil), o yüzden üretimi sunucu üstleniyor. Bkz. ADR 0011, Karar 3.

Yeni hesap **300 jant** ve başlangıç kartlarıyla geliyor.`,
          test: saveTokens,
        }),
        req({
          name: 'Misafir giriş (kayıtlı kurulum)',
          method: 'POST',
          path: '/auth/guest',
          auth: 'none',
          body: { ...device },
          desc: `Uygulamanın **ikinci ve sonraki** açılışlarında yaptığı çağrı: sakladığı \`installationId\` ile aynı misafir hesaba geri döner.

Kimliği kaybeden oyuncu hesabına bir daha erişemez — istemcide bu değerin depolama göçüyle korunmasının sebebi bu (\`src/api/storageKeys.ts\`).`,
          test: saveTokens,
        }),
        req({
          name: 'Ben kimim',
          method: 'GET',
          path: '/auth/me',
          desc: 'Access token\'ın kime ait olduğunu söyler. Token geçerliliğini sınamanın en hızlı yolu.',
        }),
        req({
          name: 'Apple / Google ile giriş',
          method: 'POST',
          path: '/auth/identity',
          body: { provider: 'APPLE', idToken: 'sahte:{{$guid}}:oyuncu@example.com', ...device },
          status: [200, 409],
          statusLabel: 'Giriş yapıldı (200) ya da hesap başkasına bağlı (409)',
          test: saveTokens,
          desc: `**Tek gerçek giriş yolu.** E-posta + şifre kaldırıldı: sağlayıcı hem kimliği hem e-postayı bizden daha iyi doğruluyor, ve şifre olmayınca sıfırlama, doğrulama, kaba kuvvet ve hesap sayımı yüzeyleri de olmuyor.

Kimlik doğrulaması **şart** (public değil): çağıran her zaman oturum açmış durumda, çünkü uygulama açılışta misafir hesap alıyor. Böylece tek uç üç işi birden yapıyor:

1. **Misafiri yükseltmek** — kimlik hiç kayıtlı değilse mevcut hesaba bağlanır, ilerleme olduğu gibi kalır (aynı satırda yükseltme, ADR 0005).
2. **Geri dönmek** — kimlik bu kullanıcıya zaten bağlıysa sadece yeni jeton.
3. **Hesabı kurtarmak** — kimlik başka bir hesaba bağlıysa o hesaba geçilir. Cihaz değiştiren oyuncunun ilerlemesini geri aldığı durum; asıl amaç bu.

Üçüncü durumda buradaki misafir hesabın ilerlemesi varsa **409** dönüyor: \`force: true\` gelmeden geçiş yok, yoksa oyuncunun saatleri sessizce silinirdi.

\`idToken\` geliştirmede sahte doğrulayıcıdan geçiyor (\`sahte:<subject>:<email>\`) — Apple/Google geliştirici hesapları henüz yok. Üretimde bu adapter devre dışı, gerçek JWKS doğrulaması çalışıyor.`,
        }),
        req({
          name: 'Token yenile',
          method: 'POST',
          path: '/auth/refresh',
          auth: 'none',
          body: { refreshToken: '{{refreshToken}}' },
          desc: `Access token'ın ömrü kısa (15 dk); süresi dolunca refresh token ile yenisi alınıyor.

Refresh token **rotasyonlu**: her yenilemede eskisi geçersizleşir ve yenisi verilir. Çalınan bir token'ın sınırsız kullanılmasını engelleyen şey bu. Yanıttaki yeni refresh token otomatik olarak değişkene yazılıyor.`,
          test: saveTokens,
        }),
        req({
          name: 'Hesabı sil',
          method: 'DELETE',
          path: '/auth/account',
          status: [204, 400],
          statusLabel: 'Silindi (204) ya da şifre gerekli/yanlış (400)',
          body: { provider: 'APPLE', idToken: 'sahte:{{$guid}}' },
          desc: `Hesabı ve bağlı bütün veriyi siler: cüzdan, defter, koleksiyon, maçlar, cihazlar.

**Zorunlu bir uç:** Apple App Store, hesap açmaya izin veren uygulamanın hesabı uygulama içinden silmeye de izin vermesini şart koşuyor (5.1.1(v)). Yani bu bir incelik değil, yayın engeli.

Bağlı hesapta sağlayıcıdan **taze bir jeton** isteniyor: silme geri alınamaz ve access token 15 dakika yaşıyor — telefonu kısa süreliğine eline geçiren biri hesabı silememeli. Apple ve Google da kendi silme akışlarında aynısını yapıyor. Misafir hesapta kimlik olmadığı için gövde boş gönderilebilir.

⚠️ Bu istek gerçekten siler. Koleksiyondaki aktif hesabınla çalıştırma.`,
        }),
        req({
          name: 'Çıkış',
          method: 'POST',
          path: '/auth/logout',
          auth: 'none',
          status: 204,
          body: { refreshToken: '{{refreshToken}}' },
          desc: `Refresh token'ı iptal eder.

Bilerek public: access token'ın süresi dolmuş olsa bile kullanıcı çıkabilmeli. Refresh token'ın kendisi zaten yetki kanıtı.`,
        }),
      ],
    },
    {
      name: 'Ekonomi',
      description: `İki para birimi var: **jant (RIM)** oynayarak kazanılıyor, **coin (COIN)** gerçek parayla alınıyor. Maç ödülü her zaman jant — coin oynayarak asla kazanılmıyor. Bkz. ADR 0008.`,
      item: [
        req({
          name: 'Cüzdan',
          method: 'GET',
          path: '/economy/wallet',
          desc: 'Tüm bakiyeler. İstemcinin ekranda gösterdiği rakamın doğruluk kaynağı burası — cihazda tutulan sayı yalnızca önbellek.',
          test: `const json = pm.response.json();
pm.test('Jant bakiyesi var', () => {
  pm.expect(json.find((b) => b.currency === 'RIM'), 'RIM').to.exist;
});`,
        }),
        req({
          name: 'İşlem defteri',
          method: 'GET',
          path: '/economy/ledger',
          query: [
            { key: 'currency', value: 'RIM' },
            { key: 'page', value: '1' },
            { key: 'limit', value: '20' },
          ],
          desc: `Bakiyeyi oluşturan hareketlerin dökümü: kayıt bonusu, maç ödülü, kart açma harcaması…

Bakiye tek başına saklanmıyor, her değişim deftere yazılıyor. "Jantım neden azaldı" sorusunun cevabı ancak böyle verilebiliyor. \`limit\` üst sınırı 100 — istemcinin \`limit=100000\` diyerek veritabanını kilitlemesini engelliyor.`,
        }),
      ],
    },
    {
      name: 'Envanter',
      description: 'Koleksiyon veritabanında, **kart kataloğu kodda**: isim/nadirlik/fiyat senkronlanan motordan okunuyor, veritabanına girmiyor. Bkz. ADR 0011.',
      item: [
        req({
          name: 'Koleksiyon',
          method: 'GET',
          path: '/inventory',
          desc: 'Oyuncunun sahip olduğu kartlar. Her kayıt `kind` alanıyla geliyor: `VEHICLE` (araç) ya da `SUPPORT` (Pit Ekibi). Kadro kurarken istemcinin dayandığı liste bu.',
        }),
        req({
          name: 'Kart aç',
          method: 'POST',
          path: '/inventory/unlock',
          body: { cardId: 'nocturne-coupe', currency: 'RIM' },
          status: [200, 400, 409],
          statusLabel: 'Açıldı (200), bakiye yetmedi (400) ya da zaten sahip (409)',
          desc: `Kart satın alır. İstemci **fiyat göndermiyor** — sadece hangi kart ve hangi keseden. Fiyata sunucu karar veriyor (\`card-catalog.ts\`); aksi halde istemci "bunu 1 janta aldım" diyebilirdi.

Bakiye düşürme ve kartın yazılması **tek transaction**: biri olup diğeri olamaz.

Örnek kart nadir (600 jant), yeni hesabın 300 janti yetmez → **400**. Yetecek bir kart için önce maç kazan. Zaten sahip olunan kart → **409**.`,
        }),
      ],
    },
    {
      name: 'Mağaza',
      description: `Paketler. Çekilişi **sunucu** yapıyor: istemci çekseydi kazanan sonucu bulana kadar deneyip onu gönderebilirdi ve oranları yayınlamanın anlamı kalmazdı. Fiyatlar ve oranlar paylaşılan motorda (\`game/packs.ts\`) — mağaza ekranının gösterdiği oranla çekilişte kullanılan oran aynı dosyadan geliyor.`,
      item: [
        req({
          name: 'Paketler',
          method: 'GET',
          path: '/store/packs',
          desc: `Satıştaki paketler, fiyatları ve çıkma oranlarıyla.

Oranlar istemcide sabit yazılmıyor, buradan geliyor. Mağaza politikaları gösterilen oranla gerçek oranın aynı olmasını zorunlu tutuyor; tek kaynak bunu yapısal olarak garanti ediyor.

Bugün iki paket var: **Temel** (350 jant · %60/26/11/3) ve **Nadir+** (800 jant · %50/33/17, sıradan kart çıkmaz).`,
          test: `const json = pm.response.json();
pm.test('Oranlar 100 ediyor', () => {
  for (const pack of json) {
    const total = Object.values(pack.odds).reduce((s, n) => s + n, 0);
    pm.expect(total, pack.id).to.eql(100);
  }
});`,
        }),
        req({
          name: 'Paket aç',
          method: 'POST',
          path: '/store/packs/{{packId}}/open',
          body: { requestId: '{{$guid}}' },
          status: [200, 400],
          statusLabel: 'Açıldı (200) ya da bakiye yetmedi (400)',
          desc: `Paket açar: jant düşülür, kart çekilir, kart zaten koleksiyondaysa değerinin **%25'i** geri verilir. Hepsi tek transaction — biri olup diğeri olamaz.

\`requestId\` tekrar korumasıdır ve **zorunludur**. Mobil ağda cevabı kaybolan bir istek tekrar gönderilirse, aynı kimlikle gelen ikinci istek yeni çekiliş yapmaz; ilk açılışın sonucunu döndürür. Olmasaydı oyuncudan iki kez para düşer ve iki kart çekilirdi.

Koleksiyonda \`{{$guid}}\` Postman'in her çalıştırmada yeni ürettiği bir UUID — gerçek istemci de her açılış için yeni bir tane üretir.

Yeni hesabın 300 janti 350'lik pakete yetmez; o yüzden ilk denemede **400** beklenir. Jant için önce maç kazan.

\`packId\` koleksiyon değişkeni: \`basic\` ya da \`rare-plus\`.`,
        }),
      ],
    },
    {
      name: 'Maç',
      description: `Maçın sonucu istemciye **sorulmuyor**. İstemci yalnızca yaptığı hamleleri gönderiyor, sunucu maçı aynı tohum ve aynı motorla yeniden oynatıp kazananı kendi buluyor. Ödül o sonuca yazılıyor. Bkz. ADR 0007.`,
      item: [
        req({
          name: 'Maç aç',
          method: 'POST',
          path: '/matches',
          status: 201,
          body: {
            difficulty: 'easy',
            vehicleCardIds: ['falconi-turbo', 'vipera-gt', 'sandstorm-buggy', 'nitro-nomad', 'boulder-baron'],
            supportCardIds: ['quick-fix', 'checkpoint', 'spare-shield'],
          },
          desc: `Maç oturumu açar. Yanıtta **tohum (seed)** ve **bot kadrosu** geliyor — ikisini de sunucu belirliyor ki doğrulama sırasında aynı maç kurulabilsin.

Kadroyu istemci **seçiyor**, sunucu **doğruluyor**: gönderilen her kimliğin gerçekten sahip olunan bir karta karşılık geldiği kontrol ediliyor. Sahip olunmayan kart → 400.

\`difficulty\`: \`easy\` · \`normal\` · \`hard\`. Zorluk garaj canını, açılış elini ve botun hata oranını değiştiriyor.`,
          test: `const json = pm.response.json();
pm.collectionVariables.set('matchId', json.matchId);
pm.test('Maç açıldı', () => pm.expect(json.matchId, 'matchId').to.be.a('string'));`,
        }),
        req({
          name: 'Maçı sonuçlandır',
          method: 'POST',
          path: '/matches/{{matchId}}/submit',
          body: { turns: [{ actions: [] }] },
          status: 400,
          desc: `Hamleleri gönderir. Gövdede **"kazandım" diye bir alan yok** — yalnızca ne yapıldığı.

Sunucu maçı yeniden oynatır ve kendi sonucunu üretir. Hamleler tutarsızsa (olmayan kartla oynamak, sırası gelmeden saldırmak) maç \`REJECTED\` olarak kaydedilir ve ödül yazılmaz. Aynı maç ikinci kez gönderilirse "zaten sonuçlandı" döner — ödül iki kez yazılmaz.

Yukarıdaki boş \`turns\` bilerek: hamlesiz gönderim reddedilmeli. Gerçek bir gövde örneği için \`docs/api/README.md\`.`,
        }),
      ],
    },
    {
      name: 'Cihaz',
      description: 'Bildirim gönderebilmek ve oyuncunun hangi cihazlardan girdiğini görebilmek için.',
      item: [
        req({
          name: 'Cihaz kaydet',
          method: 'POST',
          path: '/devices',
          body: { ...device, fcmToken: 'ornek-fcm-jetonu-en-az-yirmi-karakter' },
          desc: `Cihazı kaydeder/günceller ve varsa push jetonunu bağlar.

POST ama aslında **upsert**: uygulama her açılışta çağırabilsin diye idempotent. Daha önce kaydolup kaydolmadığını istemcinin takip etmesi gerekmiyor.

\`fcmToken\` opsiyonel — oyuncu bildirim iznini reddetmiş olabilir, cihaz kaydı yine de tutulmalı.`,
          test: `const json = pm.response.json();
if (json.id) pm.collectionVariables.set('deviceId', json.id);`,
        }),
        req({
          name: 'Cihazlarım',
          method: 'GET',
          path: '/devices',
          desc: 'Hesaba bağlı cihazlar. Son görülme zamanı burada tutuluyor; 24 saattir girmeyene hatırlatma bildirimi bu veriyle gidiyor.',
        }),
        req({
          name: 'Cihaz sil',
          method: 'DELETE',
          path: '/devices/{{deviceId}}',
          status: 204,
          desc: 'Cihaz kaydını ve push jetonunu siler. Geçersiz biçimli id veritabanına hiç ulaşmıyor (`ParseUUIDPipe`).',
        }),
      ],
    },
  ],
};

const environment = {
  id: 'cardraft-local',
  name: 'CarDraft — Yerel',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3000/api', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

writeFileSync(`${OUT}/CarDraft.postman_collection.json`, JSON.stringify(collection, null, 2) + '\n');
writeFileSync(`${OUT}/CarDraft.postman_environment.json`, JSON.stringify(environment, null, 2) + '\n');

const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`${collection.item.length} klasör, ${count} istek yazıldı.`);
