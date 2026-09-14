# Değişiklik günlüğü — Sunucu (API)

Bu dosya **sunucunun** sürüm geçmişi. Mobil uygulamanınki ayrı:
[`../CHANGELOG.md`](../CHANGELOG.md). Gerekçe için
[`../docs/gelistirme-akisi.md`](../docs/gelistirme-akisi.md).

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sürümleme [Semantic Versioning](https://semver.org/lang/tr/).
Etiket öneki: `server-v`.

Mimari kararların gerekçeleri günlükte değil, [`docs/adr/`](docs/adr/) altında.

## [Yayınlanmamış]

### Eklendi

- **Mağaza: paket açma.** `GET /api/store/packs` (fiyatlar ve oranlar) ve
  `POST /api/store/packs/:id/open`. Çekiliş sunucuda, kriptografik üreteçle;
  jant düşme, kart verme ve tekrar kart iadesi tek transaction. Tekrar
  gönderilen istek yeni çekiliş yapmıyor (`requestId`). Bkz. ADR 0013.

- `GET /api/health` — kimlik doğrulama istemeyen sağlık kontrolü; çalışan
  sürümü ve ayakta kalma süresini döner. CI, Docker ve ileride AWS yük
  dengeleyici bunu kullanacak.
- Açılış zinciri e2e duman testi: misafir giriş → cüzdan → koleksiyon,
  gerçek Postgres ve Redis ile.
- API belgesi ve çalıştırılabilir Postman koleksiyonu (`docs/api/`): 18 istek,
  token'ları kendi yakalayan script'lerle.
- **OpenAPI/Swagger**: `/api/docs` arayüzü (üretimde kapalı) ve koddan üretilen
  `docs/api/openapi.json`. Şema, controller'lardaki açıklama yorumlarından
  besleniyor — `@ApiOperation` ile ikinci bir kopya yazılmıyor.
- Katalog ve ödül kuralları için birim testleri (8 test): fiyatların
  sunucuda olduğu, ödülün her zaman jant olduğu, zorlukla arttığı.
- `npm run openapi` · `npm run postman` · `npm run check:api-docs` — belgenin
  kodla aynı kalmasını CI'da doğrulayan kontroller.
- `npm run simulate` — denge ölçümü: N maçı baştan sona oynatıp zorluk ve
  ilerleme kademesi başına kazanma oranını raporlar. Bkz. ADR 0012.
- Kadro kuralları ve bot ölçeklemesi için 11 birim testi.

### Eklendi

- **Hesap kurtarma akışları**: e-posta doğrulama, şifre sıfırlama, oturum
  açıkken şifre değiştirme ve **hesap silme** (Apple App Store'un hesap
  açmaya izin veren uygulamalardan şart koştuğu uç). Jetonlar hash'li, tek
  kullanımlık ve süreli; şifre değişince bütün oturumlar kapanıyor.
  E-posta bir port'un arkasında (`MailPort`) — sağlayıcı seçilmedi, bugün
  loga yazılıyor. Bkz. ADR 0014.
- `user_identities` tablosu: Apple/Google ile giriş için şema hazırlığı.

### Güvenlik

- **Hız sınırlama eklendi.** Daha önce hiç yoktu: `/auth/login` kaba kuvvete
  açıktı (argon2 şifreyi koruyor ama saniyede yüzlerce deneme hem zayıf
  şifreleri bulur hem sunucuyu boğar). Varsayılan dakikada 120 istek, giriş
  ve kayıtta 10. Sayaç Redis'te — süreç belleğinde tutulsaydı sunucu iki
  örneğe çıktığı gün sınır sessizce ikiye katlanırdı.

- **Kadro boyutu artık sunucuda doğrulanıyor.** DTO yalnızca her dizinin en
  fazla 8 olmasını kontrol ediyordu; toplamı kontrol eden bir şey yoktu.
  Değiştirilmiş bir istemci 8 araç + 8 destek gönderip 32 kartlık desteyle
  oynayabilirdi — deste kadronun iki katı ve deste bitince yorgunluk hasarı
  başlıyor, yani uzun maçlarda neredeyse garanti galibiyet. Kural paylaşılan
  motorda (`game/loadoutRules.ts`), hata mesajı da oradan geliyor.

### Düzeltildi

- **Maç sonucu artık verilen ödülü de döndürüyor** (`reward`). İstemci
  gösterdiği rakamı kendi hesaplıyordu; bugün aynı sonucu veriyor ama sunucu
  bir çarpan eklediğinde oyuncunun gördüğü sayı ile bakiyesine yazılan sayı
  ayrışırdı.

- **`GET /api/health` iki kez tanımlıymış.** Bağımlılıkları (Postgres, Redis,
  kuyruk) gerçekten yoklayan `HealthController` zaten vardı; CI için eklenen
  basit uç, modül sırası yüzünden onu gölgeliyordu — sağlık kontrolü
  veritabanı düşükken bile "ok" derdi. Basit uç kaldırıldı, sürüm ve ayakta
  kalma süresi gerçek kontrolün yanıtına taşındı.
- **Bot oyuncudan bir kart fazla taşıyordu** (6 araç + 3 pit = 9; oyuncunun
  bütçesi 8). Deste kadronun iki katı olduğu için bu 18'e 16 kart demekti ve
  ölçümde yorgunluğu önce oyuncu görüyordu (%33'e %24). Bot artık 5 + 3.
- Sürüm numarası `npm_package_version`'dan okunuyordu; `node dist/main` ile
  doğrudan başlatılınca (üretimde olacağı gibi) boş gelip sessizce "0.0.0"
  oluyordu. Artık `src/version.ts` üzerinden `package.json`'dan okunuyor.

### Değiştirildi

- Global uygulama kurulumu (`/api` öneki, doğrulama borusu, hata filtresi)
  `src/bootstrap.ts`'e taşındı; artık testler üretimdekiyle aynı uygulamayı
  sınıyor.

### Kaldırıldı

- Nest iskeletinden kalan `AppController`/`AppService` ve testi.

## [0.1.0] — 2026-09-14

İlk sürüm — Faz 2 backend'i.

### Eklendi

- NestJS modüler mimari, Prisma + Postgres, BullMQ + Redis (ADR 0001–0003).
- Kimlik doğrulama: access JWT + opaque refresh, misafir hesap ve yükseltme
  (ADR 0004, 0005).
- Sunucu otoriteli ekonomi ve işlem defteri (ADR 0006).
- Maçın sunucuda deterministik yeniden oynatılarak doğrulanması (ADR 0007).
- Para birimi modeli (jant/coin), `UserStats` (ADR 0008).
- Kart fiyatlandırması ve ilerleme temposu (ADR 0009, 0010).
- Envanterin sunucuya taşınması ve istemci entegrasyonu (ADR 0011).
- Bildirim altyapısı ve etkinsizlik hatırlatması.
