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

- `GET /api/health` — kimlik doğrulama istemeyen sağlık kontrolü; çalışan
  sürümü ve ayakta kalma süresini döner. CI, Docker ve ileride AWS yük
  dengeleyici bunu kullanacak.
- Açılış zinciri e2e duman testi: misafir giriş → cüzdan → koleksiyon,
  gerçek Postgres ve Redis ile.

### Değiştirildi

- Global uygulama kurulumu (`/api` öneki, doğrulama borusu, hata filtresi)
  `src/bootstrap.ts`'e taşındı; artık testler üretimdekiyle aynı uygulamayı
  sınıyor.

### Kaldırıldı

- Nest iskeletinden kalan "Hello World" ucu ve testi.

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
