# 0009 — Kart fiyatlandırması ve ilerleme temposu

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
[0008](0008-currency-model-and-server-stats.md) para birimlerini tanımladı
(jant = oynayarak, coin = satın alarak) ama hiçbir şeyin fiyatı yoktu. Aynı
sırada **seviye/yükseltme sistemi kaldırıldı** — bu kararın kendisi
fiyatlandırmayı zorunlu kıldı: yükseltme gidince ilerlemenin tek kolu
"koleksiyonu büyütmek" kaldı, yani fiyatlar artık ilerleme temposunun ta
kendisi.

Cevaplanması gereken sorular: hangi kartlar açık başlar, kilitli olanlar ne
eder, iki para birimi arasındaki oran ne olur, ve bir oyuncu ilk destansı
kartına kaç maçta ulaşır.

## Karar

### 1. Nadirliğe göre sabit fiyat tablosu (araçlar)

| Nadirlik | Jant | Coin |
|---|---|---|
| Sıradan | 300 | 50 |
| Nadir | 600 | 100 |
| Efsanevi | 1800 | 280 |
| Destansı | 3600 | 550 |

Kart başına elle fiyat yazmak yerine tablo, çünkü 35 kart var ve büyüyecek:
tek tek fiyatlanan bir katalogda ikinci ay "şu kart neden bundan pahalı"
sorusunun cevabı kalmaz. Nadirlik zaten kartın gücünü tarif eden mevcut
etiket; fiyatı ona bağlamak yeni bir kavram getirmiyor.

Jant/coin oranı ≈ **6,5** — LoL'ün 6300 mavi öz / 975 RP oranıyla aynı yerde.
Oran sabit tutuldu ki "hangi kart parayla daha kârlı" diye bir hesap oluşmasın.

### 2. Altı kart başlangıçta açık
Beş araç + üç Pit Ekibi kartı = tam bir kadro, ilk maç kurulum yapmadan
başlıyor. Altıncı araç yedek olarak duruyor. Daha cömert bir başlangıç (ilk
plan 12 kartı açıktı) ilk satın almayı anlamsızlaştırıyordu: oyuncunun eli
zaten doluyken kilit açmanın heyecanı yok.

### 3. Pit Ekibi: nadirlik değil GÜÇ SEVİYESİ (1–4), ve daha sert fiyatlar

| Güç | Jant | Coin | Kartlar |
|---|---|---|---|
| 1 | 0 (açık) | 0 | Hızlı Tamir, Checkpoint, Yedek Kalkan |
| 2 | 1200 | 190 | Pusu, Feda Manevrası |
| 3 | 2600 | 400 | Motor Arızası, Yol Kapama, Son Şans |
| 4 | 4200 | 640 | Turbo Şarj, Soğuk Başlangıç, Kafa Karıştır |

İki ayrım var ve ikisi de bilinçli:

**Neden nadirlik değil güç seviyesi?** Destek kartlarının nadirliği yok —
hepsi aynı kategoride ve etkileri doğrudan karşılaştırılabilir ("bir saldırıyı
iptal et" ile "+2 yakıt" arasında bir sıralama yapılabilir, iki aracın gücü
arasında yapıldığı gibi). Var olmayan bir etiketi fiyat için uydurmak yerine,
gerçek ayrımı (etkinin oyunu ne kadar değiştirdiği) fiyata bağladık.

**Neden araçlardan pahalı?** En pahalı araç 3600 jant, güç-4 bir destek kartı
4200. Sebep arz kıtlığı: 35 araç var ve her ay yenisi eklenebilir, Pit Ekibi
ise 11 tane ve neredeyse sabit kalacak — yeni bir destek kartı tasarlamak yeni
bir araç eklemekten çok daha zor, çünkü her biri kuralların kendisini
değiştiriyor. Kıt olan kaynak daha değerli olmalı; ucuz olsaydı oyuncu tüm
destek havuzunu birkaç günde tamamlar ve ilerlemenin bu kolu biterdi.

### 4. Maç ödülü zorluğa bağlandı
`WIN_REWARD = 170`, `LOSS_REWARD = 55`, zorluk çarpanı kolay 0,8 / normal 1,0 /
zor 1,35.

Hedef: **~28 maçta bir destansı kart**. Normal zorlukta %65 kazanma oranıyla
maç başı ≈ 130 jant, 3600 / 130 ≈ **27,7 maç** — tutuyor.

Çarpan olmasaydı zorluk seçimi süs olurdu: aynı ödül için herkes Kolay'da
oynar. Kaybedince de ödül var (0 değil), çünkü sıfır ödül kaybeden oyuncuyu
oyunu kapatmaya iter.

### 5. Ödül miktarının tek kaynağı paylaşılan motor
Sayılar `src/game/difficulty.ts` içinde (istemci), `scripts/sync-engine.mjs`
ile sunucuya kopyalanıyor. Sunucu hâlâ otorite — sadece otoritenin okuduğu
dosya tek.

Bunu bir kez zor yoldan öğrendik: sunucuda `BATTLE_REWARD = {win: 120,
loss: 30}` elle yazılıydı, istemci 170'e çıkınca sunucu 120'de kaldı. Oyuncuya
gösterilen ödülle bakiyesine yazılan ödül tutmadı. Aynı hata daha önce bot
desteleri ve zorluk ayarlarında da olmuştu (bkz. sync-engine listesi) — kural
netleşti: **iki tarafın da aynı sayıya ihtiyacı varsa, o sayı senkronlanan
motorda durur.**

## Sonuç

- Tüm araçlar: 44.100 jant / 6.860 coin.
- Tüm Pit Ekibi: 22.800 jant / 3.500 coin.
- Tam koleksiyon: **66.900 jant** ≈ 515 maç (normal, %65 kazanma) — ya da
  10.360 coin.

## Yan etki: bir güvenlik açığı kapandı
Fiyatları bağlarken `POST /economy/battle-reward` uç noktası fark edildi ve
**kaldırıldı**. "Tutarı istemci göndermiyor, sadece sonucu" yeterli sanılmıştı;
değildi — istemci her çağrıda uydurma bir `battleId` üretip `won: true`
diyebiliyordu ve idempotency anahtarı o uydurma kimlik olduğu için her çağrı
yeni bir ödül yazıyordu. Sonsuz jant.

Ödülün tek yolu artık `POST /matches/:id/submit`
([0007](0007-server-side-match-verification.md)): maçı sunucu açıyor, istemci
yalnızca hamleleri gönderiyor, sunucu maçı yeniden oynatıp kazananı kendi
buluyor.

Ders: doğrulanmamış bir uç nokta, yerine doğrulanmış bir yol yazıldığında
kendiliğinden kaybolmuyor. Yenisini eklerken eskisini silmek işin parçası.
