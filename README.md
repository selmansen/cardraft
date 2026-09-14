# CarDraft

Araç temalı, sıra tabanlı koleksiyon kart oyunu. React Native (Expo) istemci +
NestJS sunucu.

İki oyuncunun (şimdilik oyuncu ile bot) birer **garajı** var. Garajın canı
biterse maç biter. Arada, sahaya sürdüğün araçlar ve onları güçlendiren pit
ekibin duruyor.

> **Durum:** geliştirme aşamasında, henüz yayında değil.
> Faz 1 ve Faz 2 çalışıyor, Faz 3 planlı — ayrıntısı aşağıda.

---

## Oyun

**Tur akışı.** Her turda **yakıt** kazanırsın ve yakıt harcayarak elindeki
araçları sahaya sürersin. Sahadaki araçlar rakibin araçlarına ya da doğrudan
garajına saldırır. Araçlar sahaya çıktıkları tur saldıramaz — bir tur ısınmaları
gerekir. Saldırı, aracı hedefin üstüne **sürükleyerek** yapılır.

**Araç kartları.** Üç sayı taşır: **Güç** (vurduğu hasar), **Dayanıklılık**
(dayandığı hasar) ve **Hız**. Hız savunmadan kaçınmayı sağlıyor: saldıran araç
hedefinden yeterince hızlıysa karşı hasarı hiç yemiyor — yani hızlı bir araç,
kendinden güçlü bir hedefe zarar görmeden vurabilir. 35 araç var, 7 kategoriye
ayrılmış — Spor, Arazi, Klasik, Gelecek, Hizmet, Canavar, İş Makinesi — ve her
kategorinin kendi oynanış kimliği var: spor arabalar hızlı ama kırılgan, iş
makineleri yavaş ama siper kurup arkasındakini korur.

**Pit Ekibi.** 11 destek kartı. Sahada yer kaplamaz, yakıt istemez, oynandığı
anda etkisini verip biter: tamir, geçici güç takviyesi, ek saldırı hakkı.

**Kadro.** Maça girmeden önce koleksiyonundan **8 kart** seçersin: en az 3'ü
araç olmak zorunda, en fazla 5'i pit kartı olabilir. Deste kurmanın tamamı bu
ekranda oluyor ve asıl tercih burada — aldığın her pit kartı, sahaya
süremeyeceğin bir araç demek.

**İlerleme.** Maç kazandıkça **jant** kazanır, jantla yeni kart açarsın.
**Coin** ise gerçek parayla alınır ve aynı kartları daha hızlı açmaya yarar.
Kart **seviyesi yok** — hiçbir kart parayla güçlendirilemez, para yalnızca
koleksiyonu büyütme hızını değiştirir. Bu bilinçli bir sınır: ödeyen oyuncunun
daha güçlü kartları değil, daha çok seçeneği olur.

Başlangıçta 6 araç ve 3 pit kartı açık geliyor; gerisi oynayarak açılıyor.

---

## Durum ve hedef

| Faz | Kapsam | Durum |
|---|---|---|
| **Faz 1** | Tek oyunculu prototip: savaş motoru, kart havuzu, arayüz, bota karşı iki zorluk | ✅ Çalışıyor |
| **Faz 2** | Sunucu: hesap, cüzdan, envanter, sunucuda maç doğrulama, bildirim altyapısı | ✅ Çalışıyor |
| **Faz 3** | Gerçek zamanlı PvP, eşleştirme, lig/ranked, mağaza ekranı | ⏳ Planlı |

**Sıradaki işler**

- Kart havuzunu 35'ten **50 araca** çıkarmak (MVP hedefi).
- Bot ölçeklemesi: oyuncu ilerledikçe botun destesi de güçlensin.
- Mağaza ekranı ve kart paketleri.
- Kadronun sunucuda tutulması (şu an yalnızca cihazda).

**Yayın hedefi:** 50 araç kartı, mağaza ve ranked hazır olduğunda ilk mağaza
sürümü. Tarih taahhüdü yok.

**Sabit kısıtlar** — tasarımın başından beri geçerli, değişmeyecek:

- **Gerçek araç markası ya da logosu kullanılmıyor.** Tüm araçlar kurgusal.
- **Serbest metin sohbet yok.** PvP geldiğinde iletişim hazır mesaj ve
  emojiyle sınırlı kalacak; hem çocuk güvenliği hem mağaza onayı için.
- **Güç satılmıyor.** Gerçek para koleksiyonu hızlandırır, kartı güçlendirmez.

---

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
└── docs/                tasarım sistemi, API belgesi, geliştirme akışı
```

**Oyuncunun ilerlemesiyle ilgili her şey sunucuda:** cüzdan, koleksiyon,
istatistikler. Maçın sonucu istemciye de sorulmuyor — istemci yalnızca
yaptığı hamleleri gönderiyor, sunucu maçı **yeniden oynatıp** kazananı kendi
buluyor ve ödülü o sonuca yazıyor.

**Savaş motoru tek bir yerde yazılı.** `src/game/` altındaki saf motor,
`server/scripts/sync-engine.mjs` ile sunucuya kopyalanıyor. Yeniden oynatmanın
doğru sonucu vermesi iki tarafın **aynı** kodu çalıştırmasına dayanıyor; elle
senkron tutulan iki kopya bunu ilk sapmada bozardı.

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
| [API belgesi](docs/api/) | Uç noktalar + hazır Postman koleksiyonu |
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
