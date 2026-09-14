# 0002 — Prisma şemasının domain bazlı dosyalara bölünmesi

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
Prisma'nın varsayılanı tek bir `schema.prisma`. Bu projede tablolar kimlik,
cihaz, ekonomi, sosyal gibi ayrı alanlara yayılacak.

## Karar
`prisma/schema/` klasörü; `schema.prisma` yalnızca `generator` + `datasource`
içerir, tablolar domain başına ayrı dosyalarda (`auth.prisma`,
`device.prisma`, ileride `economy.prisma`).

## Gerekçe
- Tek dosya, model sayısı arttıkça kimsenin baştan sona okumadığı bir dosyaya
  dönüşür; bir modeli bulmak arama gerektirir.
- Aynı dosyaya dokunan her değişiklik merge çakışması adayıdır.
- Klasör yapısı `src/modules/` ile birebir örtüşüyor: bir domainde çalışırken
  hem kodu hem şeması aynı isimle bulunuyor.

## Uygulama notları (bu sürümde tuzak olan yerler)
- Çoklu şema dosyası Prisma **6.7'den beri GA**; preview bayrağı gerekmiyor.
- Prisma 7'de `prisma.config.ts` zorunlu ve `schema` **klasörü** göstermeli.
  Dosya gösterilirse Prisma yalnızca o dosyayı okur, diğer domainlerdeki
  modeller üretilen istemciye **sessizce** girmez — hata da vermez.
- Prisma 7'de bağlantı URL'si artık şema dosyasında olamaz: CLI için
  `prisma.config.ts`, çalışma zamanı için driver adapter (`@prisma/adapter-pg`).
- Üretilen istemci `src/generated/prisma`'ya çıkıyor (node_modules'a değil).
  Eski `prisma-client-js` üreticisi CJS yazdığı için bu ESM projesinde
  import edilemiyordu; yeni `prisma-client` üreticisi ESM uyumlu.

## Sonuçları
- Üretilen kod repoda değil, `postinstall` ile üretiliyor (gitignore'lu).
- Şema klasörü büyüdükçe dosya adları domain adlarını takip etmeli; yeni
  domain açan herkes aynı deseni sürdürmeli.
