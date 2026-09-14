# CarDraft API

Sunucunun bütün uç noktaları, çalıştırılabilir bir Postman koleksiyonu olarak.

| Dosya | |
|---|---|
| [`CarDraft.postman_collection.json`](CarDraft.postman_collection.json) | 18 istek, 6 klasör — token yakalama script'leriyle |
| [`CarDraft.postman_environment.json`](CarDraft.postman_environment.json) | `baseUrl` (yerel geliştirme) |

---

## Kurulum

**1. Sunucuyu çalıştır**

```bash
cd server
docker compose up -d          # Postgres + Redis
npm run start:dev             # http://localhost:3000/api
```

> `docker` komutu bulunamazsa: `export PATH="$HOME/.docker/bin:$PATH"`

**2. Postman'e aktar**

*Import* → iki JSON dosyasını da seç → sağ üstten **CarDraft — Yerel**
ortamını aktif et.

**3. Çalıştır**

`Kimlik → Misafir giriş (yeni kurulum)` isteğini gönder. Bu kadar — dönen
token'lar otomatik olarak koleksiyon değişkenlerine yazılıyor ve diğer bütün
istekler onları kullanıyor. Elle kopyalaman gereken hiçbir şey yok.

Sonra istediğin isteği gönderebilirsin: *Cüzdan* 300 jant gösterir,
*Koleksiyon* başlangıç kartlarını listeler, *Maç aç* yeni bir oturum açar.

Tamamını bir kerede koşturmak için koleksiyona sağ tık → **Run collection**.
Terminalden de olur:

```bash
npx newman run docs/api/CarDraft.postman_collection.json \
  -e docs/api/CarDraft.postman_environment.json
```

---

## Kimlik doğrulama nasıl çalışıyor

Koleksiyon seviyesinde **Bearer** yetkilendirmesi tanımlı (`{{accessToken}}`),
yani her isteğe tek tek eklemek gerekmiyor. Kimlik istemeyen uçlar (sağlık
kontrolü, giriş, kayıt, yenileme, çıkış) kendi içinde `No Auth` ile bunu
kapatıyor.

Sunucuda kural **ters** kurulmuş: guard global, yani her uç nokta kapalı
doğuyor ve açmak için açıkça `@Public()` yazmak gerekiyor. Tersi olsaydı yeni
bir uç nokta yazıp dekoratörü unutmak, sessizce herkese açık bir kapı
bırakırdı. Unutmanın cezası bu kurulumda "401 alıyorum, neden?"; diğerinde
"verilerim açıkta".

**Access token 15 dakika** yaşıyor. Süresi dolunca 401 almaya başlarsın —
*Token yenile* isteğini gönder, yeni token otomatik yazılır. Refresh token
rotasyonlu: her yenilemede eskisi geçersizleşiyor.

### Değişkenler

| Değişken | Nereden geliyor |
|---|---|
| `baseUrl` | Ortam dosyası — `http://localhost:3000/api` |
| `accessToken`, `refreshToken` | Her giriş/yenileme isteğinden otomatik |
| `installationId` | Misafir girişinden otomatik (sunucu üretiyor) |
| `matchId` | *Maç aç* isteğinden otomatik |
| `deviceId` | *Cihaz kaydet* isteğinden otomatik |
| `email`, `password` | Elle — kayıt/giriş denemeleri için |

---

## Uç noktalar

Hepsi `/api` öneki altında.

### Sistem

| | | |
|---|---|---|
| `GET` | `/health` | Sürüm + ayakta kalma süresi. Kimlik istemez. |

### Kimlik — `/auth`

| | | |
|---|---|---|
| `POST` | `/auth/guest` | Misafir giriş. `installationId` yoksa sunucu üretir. |
| `POST` | `/auth/register` | E-postalı hesap aç (201) |
| `POST` | `/auth/login` | Giriş |
| `POST` | `/auth/link` | Misafir hesabı e-postaya bağla (kimlik ister) |
| `POST` | `/auth/refresh` | Token yenile (rotasyonlu) |
| `POST` | `/auth/logout` | Refresh token'ı iptal et (204) |
| `GET` | `/auth/me` | Oturumdaki kullanıcı |

Misafir hesap, oyuncu hiçbir şey yapmadan açılıyor ve ilerleme oraya
yazılıyor. Sonradan e-posta bağlandığında **yeni satır açılmıyor, aynı satır
yükseltiliyor** — cüzdan, koleksiyon ve istatistikler olduğu gibi kalıyor.

### Ekonomi — `/economy`

| | | |
|---|---|---|
| `GET` | `/economy/wallet` | Tüm bakiyeler |
| `GET` | `/economy/ledger` | İşlem geçmişi · `currency`, `page`, `limit` (en fazla 100) |

`RIM` (jant) oynayarak kazanılıyor, `COIN` gerçek parayla alınıyor. Maç ödülü
**her zaman jant**. Bakiye tek başına saklanmıyor; her değişim deftere
yazılıyor, bakiye onun toplamı.

### Envanter — `/inventory`

| | | |
|---|---|---|
| `GET` | `/inventory` | Koleksiyon — her kayıtta `kind`: `VEHICLE` \| `SUPPORT` |
| `POST` | `/inventory/unlock` | Kart aç — `{ cardId, currency }` |

İstemci **fiyat göndermiyor**, sadece hangi kart ve hangi kese. Bakiye
düşürme ve kartın yazılması tek transaction.

Başlangıçta 6 araç ve 3 pit kartı bedava geliyor, gerisi açılıyor. Araç
fiyatları nadirliğe bağlı: sıradan 300 · nadir 600 · epik 1800 · efsanevi 3600
jant. Yani yeni hesabın 300 janti ancak tek bir sıradan araca yetiyor —
koleksiyondaki *Kart aç* örneği nadir bir kart istediği için `400` döner.

### Maç — `/matches`

| | | |
|---|---|---|
| `POST` | `/matches` | Oturum aç — `{ difficulty, vehicleCardIds, supportCardIds }` (201) |
| `POST` | `/matches/:id/submit` | Hamleleri gönder — `{ turns }` |

Kadro: toplam **8 kart**, en az 3 araç, en fazla 5 pit.
`difficulty`: `easy` · `normal` · `hard`.

**Maç aç** yanıtı:

```json
{
  "matchId": "60e36102-b767-4def-91af-fdf67c1a017d",
  "seed": "4a46f5ff-db92-4744-9ba3-28024b415f93",
  "botLoadout": [{ "cardId": "chrome-cruiser" }, { "cardId": "volt-scout" }],
  "botSupportLoadout": ["checkpoint", "quick-fix"],
  "label": "Kolay",
  "blurb": "Bot garajı 20 (seninki 30), açılışta 4 kart, bot bol bol hata yapar…",
  "botGarageHp": 20,
  "playerGarageHp": 30,
  "playerOpeningHand": 4,
  "botOpeningHand": 3,
  "botBlunderChance": 0.35,
  "rewardMultiplier": 0.8
}
```

Zorluk ayarları da yanıtta: istemci bunları kendi sabitlerinden okumuyor,
sunucudan alıyor — denge ayarı değiştiğinde uygulamayı güncellemek gerekmesin
diye. `rewardMultiplier` ödülü zorluğa bağlıyor (kolay 0,8 · normal 1 ·
zor 1,35); olmasaydı herkes kolayda farmlar ve zorluk seçimi süs olurdu.

Tohumu ve bot kadrosunu sunucu belirliyor — doğrulama sırasında **aynı maçın**
kurulabilmesi buna bağlı.

**Gönderim gövdesi** — her tur, o turda yapılan hamlelerin listesi:

```json
{
  "turns": [
    {
      "actions": [
        { "type": "PLAY", "handIndex": 0 },
        { "type": "PLAY_SUPPORT", "handIndex": 2, "targetUid": "v3" },
        { "type": "ATTACK", "attackerUid": "v1", "target": "garage" },
        { "type": "ATTACK", "attackerUid": "v2", "target": "e4" }
      ]
    },
    { "actions": [] }
  ]
}
```

| Hamle | Alanlar |
|---|---|
| `PLAY` | `handIndex` · saha doluysa `scrapUid` (kendi aracını hurdaya ayırıp yer açar) |
| `PLAY_SUPPORT` | `handIndex` · yetenek hedef istiyorsa `targetUid` |
| `ATTACK` | `attackerUid` · `target`: `"garage"` ya da hedef aracın kimliği |

Boş `actions` "hamle yapmadan turu bitir" demek.

Gövdede **"kazandım" diye bir alan yok**. Sunucu maçı aynı tohum ve aynı
motorla yeniden oynatıp kazananı kendi buluyor:

```json
{ "won": true, "turns": 9, "balance": { "currency": "RIM", "balance": 420 }, "stats": { "battlesWon": 1 } }
```

Hamleler tutarsızsa (olmayan kartla oynamak, sırası gelmeden saldırmak) maç
`REJECTED` olarak kaydediliyor ve ödül yazılmıyor. Aynı maç ikinci kez
gönderilirse "zaten sonuçlandı" dönüyor — ödül iki kez yazılmıyor.

> Koleksiyondaki *Maçı sonuçlandır* isteği bilerek **boş** tur gönderiyor ve
> `400` alıyor: hamlesiz bir maçın kazanılmış sayılmaması gerektiğini
> gösteriyor. Kazanan bir gövde elle yazılamaz — tohuma ve dağıtılan ele bağlı.

### Cihaz — `/devices`

| | | |
|---|---|---|
| `POST` | `/devices` | Kaydet/güncelle + push jetonu bağla (upsert) |
| `GET` | `/devices` | Hesaba bağlı cihazlar |
| `DELETE` | `/devices/:id` | Kaydı sil (204) |

`POST` idempotent: uygulama her açılışta çağırabilsin diye. 24 saattir
girmeyen oyuncuya hatırlatma bildirimi buradaki `lastSeenAt` ile gidiyor.

---

## Hata biçimi

Bütün hatalar aynı zarfla dönüyor (`AllExceptionsFilter`):

```json
{
  "statusCode": 400,
  "message": "Yetersiz bakiye",
  "path": "/api/inventory/unlock",
  "timestamp": "2026-09-14T13:36:40.975Z"
}
```

| Kod | Ne demek |
|---|---|
| `400` | Doğrulama hatası, yetersiz bakiye, sahip olunmayan kart, tutarsız maç |
| `401` | Token yok, geçersiz ya da süresi dolmuş → *Token yenile* |
| `404` | Kayıt bulunamadı |
| `409` | Çakışma — kart zaten sahip olunuyor, hesap zaten bağlı |

Doğrulama **global**: DTO'da tanımlı olmayan bir alan gönderirsen istek
reddediliyor (sessizce atılmıyor). `{"coins": 999999}` gibi fazladan bir
alanın beklenmedik bir yere sızmasını engelleyen ilk savunma hattı bu.

---

## Koleksiyonu güncel tutmak

Koleksiyon elle yazıldı ve **otomatik üretilmiyor** — yeni bir uç nokta
eklediğinde buraya da eklemek gerekiyor. Kalıcı çözüm bir OpenAPI şeması
(`@nestjs/swagger`) ve ondan üretilen koleksiyon; henüz kurulmadı.

O gün gelene kadar pratik kontrol: koleksiyondaki istek sayısı ile
controller'lardaki uç nokta sayısı aynı mı?

```bash
grep -rcE "@(Get|Post|Put|Patch|Delete)\(" server/src/modules/*/*.controller.ts server/src/app.controller.ts \
  | awk -F: '{ n += $2 } END { print n " uç nokta" }'
node -e "const c=require('./docs/api/CarDraft.postman_collection.json'); \
  console.log(c.item.reduce((n,f)=>n+f.item.length,0) + ' istek')"
```

> İki sayı birebir eşleşmiyor: `/auth/guest` koleksiyonda iki isteğe ayrıldı
> (yeni kurulum / kayıtlı kurulum), çünkü ikisi farklı davranışı gösteriyor.
> Yani beklenen fark **+1**.
