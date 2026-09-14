# 0001 — Modüler NestJS mimarisi ve katman ayrımı

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
Backend, oyunun kimlik/ekonomi/sosyal ihtiyaçlarını karşılayacak ve zamanla
büyüyecek. Tek geliştiriciyle yürüdüğü için yapının kendisi disiplini
dayatmalı; "dikkat ederek" korunan bir düzen ilk yoğun günde bozulur.

## Karar
Üç katman, net sorumluluklarla:

```
controller  → HTTP: yol, durum kodu, gövde doğrulama. İş kuralı YOK.
service     → iş kuralı. HTTP tipi (Request/Response) GÖRMEZ.
repository  → veri erişimi (Prisma). İş kuralı YOK.
```

Klasörleme teknik türe göre değil (`controllers/`, `services/`), **domaine**
göre (`modules/auth/`, `modules/devices/`). Altyapı ayrı: `infrastructure/`
(prisma, cache, queue) ve `common/` (paylaşılan DTO, filtre, dekoratör).

## Gerekçe
- **Domaine göre klasörleme:** bir özellik üzerinde çalışırken tek klasörde
  kalıyorsun. Türe göre bölünmüş yapıda tek bir değişiklik üç klasörü
  dolaşmayı gerektirir ve modüller arası sınır görünmez olur.
- **Controller'ın ince olması:** aynı iş akışını yarın bir WebSocket
  bağlantısından ya da kuyruk işçisinden çağırmak gerekirse servis olduğu gibi
  kullanılabiliyor. HTTP'ye bağımlı bir serviste bu kopyalama demek olurdu.
- **Modül `exports`:** her modül sadece dışarıya açmak istediği servisi
  export ediyor. Böylece "kim kimi kullanabilir" derleyici tarafından
  denetleniyor, konvansiyona bırakılmıyor.
- `@Global()` sadece gerçekten çapraz kesen altyapıya verildi (config, prisma,
  cache, queue). İş modülleri asla global değil — bağımlılıkların görünür
  kalması mimarinin kendisi.

## Sonuçları
- Dosya sayısı, "tek dosyada controller+service" yaklaşımına göre fazla.
  Karşılığında her dosyanın tek bir sebebi var (SRP).
- Erken soyutlamaya karşı bilinçli sınır: bir mantık **üçüncü kez**
  tekrarlanmadan ortak bir tabana çıkarılmayacak. Yanlış soyutlama,
  duplikasyondan pahalıdır.
