# CarDraft

Araç temalı, sıra tabanlı koleksiyon kart savaş oyunu. React Native (Expo)
istemci + NestJS sunucu.

> **Durum:** geliştirme aşamasında. Faz 1 (tek oyunculu prototip) ve Faz 2
> (sunucu, ekonomi, envanter) çalışıyor; Faz 3 (gerçek zamanlı PvP) planlı.

---

## Ne var

**Oyun** — Hearthstone tarzı sıra tabanlı savaş: yakıt ekonomisi, sürükle-bırak
saldırı, siper/kalkan mekanikleri. 35 araç kartı (7 kategori) ve 11 "Pit Ekibi"
destek kartı. Bota karşı iki zorluk seviyesi.

**Sunucu** — Oyuncunun ilerlemesiyle ilgili her şey sunucuda: cüzdan,
koleksiyon, istatistikler. Maç sonucu istemciye sorulmuyor — sunucu maçı
gönderilen hamlelerle **yeniden oynatıp** kazananı kendi buluyor, ödül o
sonuca yazılıyor.

## Teknolojiler

| Taraf | |
|---|---|
| İstemci | Expo SDK 57 · React Native 0.86 · Expo Router · Zustand · Reanimated 4 · TypeScript |
| Sunucu | NestJS 12 · Prisma 7 · PostgreSQL · BullMQ + Redis · Passport/JWT · Vitest |
| Altyapı | Docker Compose · GitHub Actions |

## Mimari

```
├── app/                 ekranlar (Expo Router, dosya tabanlı yönlendirme)
├── src/
│   ├── game/            savaş motoru — saf, UI'dan bağımsız
│   ├── data/            kart kataloğu
│   ├── store/           Zustand (oyun durumu + sunucu oturumu ayrı)
│   └── api/             sunucu istemcisi
├── server/
│   ├── src/modules/     auth · economy · inventory · match · notification
│   ├── src/game-engine/ istemciden senkronlanan motor kopyası (üretilen)
│   ├── prisma/schema/   domain'e göre bölünmüş şema
│   └── docs/adr/        mimari karar kayıtları
└── docs/                tasarım sistemi, yol dokümanı, geliştirme akışı
```

**Savaş motoru tek bir yerde yazılı.** `src/game/` altındaki saf motor,
`server/scripts/sync-engine.mjs` ile sunucuya kopyalanıyor. Sunucunun maçı
bağımsız olarak yeniden oynatabilmesi, iki tarafın **aynı** kodu çalıştırmasına
dayanıyor; elle senkron tutulan iki kopya bunu ilk sapmada bozardı.

## Kurulum

Gerekenler: Node 22+, Docker.

```bash
# 1. Bağımlılıklar
npm install
cd server && npm install && cd ..

# 2. Veritabanı ve kuyruk
cd server
cp .env.example .env
docker compose up -d
npx prisma migrate deploy

# 3. Sunucu (http://localhost:3000/api)
npm run start:dev

# 4. İstemci — ayrı terminalde, kök dizinde
npm start
```

Telefondaki Expo Go ile QR kodu okut. İstemci, API adresini Expo'nun
geliştirme sunucusundan türetiyor; elle IP yazman gerekmiyor.

Sunucuya ulaşılamazsa oyun **çevrimdışı** çalışır — oynanır ama ödül vermez.

## Komutlar

```bash
npm run typecheck        # istemci tip kontrolü

cd server
npm run start:dev        # izlemeli sunucu
npm run lint             # oxlint
npm run build            # nest build (motoru da senkronlar)
npm test                 # birim testleri
npm run test:e2e         # e2e (çalışan Postgres + Redis ister)
npm run db:studio        # Prisma Studio
```

## Belgeler

| | |
|---|---|
| [Geliştirme akışı](docs/gelistirme-akisi.md) | Dallar, sürümleme, yayın, CI |
| [Mimari karar kayıtları](server/docs/adr/) | Her önemli kararın gerekçesi |
| [Yol dokümanı](docs/cardraft-yol-dokumani.md) | Oyun tasarımı ve faz planı |
| [Tasarım sistemi](docs/design/) | Renk, tipografi, bileşenler |

Mimari bir karar verildiğinde gerekçesi ADR'ye yazılıyor. Sebebi: "neden
kuyruk bir adapter'ın arkasında" sorusunun cevabı koda bakarak bulunamaz —
o an kafada olan gerekçe, yazılmazsa kaybolur.

## Sürümler

Uygulama ve sunucu ayrı sürümleniyor: `app-v0.1.0` ve `server-v0.1.0`.
Gerekçesi ve yayın adımları [geliştirme akışında](docs/gelistirme-akisi.md#4-sürümleme).

Değişiklik günlükleri: [uygulama](CHANGELOG.md) · [sunucu](server/CHANGELOG.md).
