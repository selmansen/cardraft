# 0010 — PvP tur süresi, paket modeli ve monetizasyonun şekli

**Durum:** Kabul edildi · 2026-09-14
**İlgili:** [0008](0008-currency-model-and-server-stats.md) (jant/coin), [0009](0009-card-pricing-and-progression.md) (fiyat tablosu)

## Bağlam

[0009](0009-card-pricing-and-progression.md) kartları fiyatladı ve ilerleme
temposunu ~28 maç/destansı olarak ayarladı. Geriye üç açık soru kaldı:

1. PvP'de (Faz 3) bir tur ne kadar sürmeli, ve rakibini bekleterek yıpratan
   oyuncuya ne olacak?
2. Kart paketi ekleyecek miyiz, eklersek hangi oranlarla?
3. Coin'i kim, neden satın alacak?

Bu ADR'nin ayırt edici yanı: **her sayı simülasyonla doğrulandı**, tahminle
değil. Maç süresi motorun kendi zamanlama sabitlerinden + 500 maçlık
simülasyondan; paket oranları Monte Carlo'dan. Sayıların nereden geldiği
aşağıda tek tek yazılı.

## Ölçüm tabanı: bir maç ne kadar sürüyor?

Bunu bilmeden hiçbir ekonomi kararı verilemezdi — "515 maç" bir sayı değil, bir
süre. Motorun zamanlama sabitleri (`app/battle.tsx`) + 500 maçlık simülasyon:

| bileşen | maç başına | süre | pay |
|---|---|---|---|
| Metin banner (blur info, 1900 ms) | 35,0 kez | 66,5 sn | %49 |
| Tur banner (1430 ms) | 19,5 kez | 27,9 sn | %21 |
| Kart geliş animasyonu (1740 ms) | 13,7 kez | 23,9 sn | %18 |
| Vuruş beklemesi (~670 ms) | 12,5 kez | 8,4 sn | %6 |
| Çekilen kart gösterimi (950 ms) | 8,9 kez | 8,5 sn | %6 |
| **zorunlu toplam** | | **2,25 dk** | |

Üstüne oyuncunun kendi karar süresi: maç başına 25,7 hamle × ~3 sn ≈ 1,3 dk.

**→ maç ≈ 3,5 dk, 19,4 tur.** Bu ADR'deki bütün "kaç maç / kaç saat"
dönüşümleri bu sayıya dayanıyor.

Dikkat çeken yan bulgu: **maçın %64'ü animasyon.** Yani `SWEEP_TEXT` gibi bir
sabiti değiştirmek, oyunun ekonomi temposunu da değiştiriyor. İkisi aynı
kadranın iki ucu — akıcılık artarsa runway kısalır. Bilerek seçilmeli.

## Karar 1 — Tur süresi ve bağlantı kopması

**35 sn saf düşünme süresi, animasyon sırasında DURAKLATILMIŞ.**

Simülasyondan oyuncu turu başına:

| | ort | p90 | p99 | max |
|---|---|---|---|---|
| Karar sayısı | 2,6 | 5 | 6 | 7 |
| Zorunlu animasyon | 4,5 sn | 7,6 sn | 9,5 sn | 11,4 sn |

Duraklatma şart, çünkü en yoğun turun ~10 saniyesi animasyon — ve bu tam olarak
oyuncunun en çok düşünmesi gereken tur. Timer animasyon boyunca da işleseydi,
süreyi en çok ihtiyaç duyulan yerde kısaltmış olurduk. İstemcide `uiLocked`
zaten bu durumu biliyor; sunucu tarafındaki sayaç da aynı sinyale bağlanacak.

- İlk tur +15 sn (el okuma).
- Son 10 sn'de görsel uyarı.
- Süre dolunca tur otomatik biter — **mağlubiyet değil.**
- Süre **sunucuda** tutulur ([0007](0007-server-side-match-verification.md)
  ile aynı ilke: istemci sayacı bypass edilir).

**AFK/oyalanma cezası YOK — bilinçli karar.** Bir süre "3 ardışık timeout =
hükmen mağlubiyet" düşünüldü ve reddedildi: süreyi sonuna kadar kullanmak
meşru bir taktik olabilir, ve tur sayacı zaten üst sınırı koyuyor. Hiç hamle
yapmayan oyuncu zaten hızla kaybediyor.

**Bağlantı kopması ayrı ele alınıyor:** kopar kopmaz 60–90 sn yeniden bağlanma
penceresi, dönmezse hükmen. Karşı taraf "rakip bağlanmaya çalışıyor" görür.
AFK kuralıyla (3 tur × 35 sn ≈ 2 dk) beklemek, kopan tarafın suçu olmayan bir
durumda rakibi gereksiz rehin tutmak olurdu.

*Açık kalan, ucuz emniyet supabı:* art arda 2 kez süre dolduran oyuncunun
sayacı 10 sn'ye düşsün, bir hamle yapınca 35'e dönsün. Mağlubiyet yok,
taktiksel oyalanma duruyor, yıpratmanın değeri gidiyor. Gerekirse eklenecek.

## Karar 2 — Paketler: tek kart, iki tip

**Tek kartlık paket** (çok kartlık değil), çünkü havuz küçük: 3 kartlık paket
35 kartlık koleksiyonu birkaç açılışta doldurup mekaniği bitiriyor.

| | fiyat | oranlar | işlevi |
|---|---|---|---|
| **Temel** | 350 jant | sıradan %60 · nadir %26 · efsanevi %11 · destansı %3 | hacim |
| **Nadir+** | 800 jant | nadir %50 · efsanevi %33 · destansı %17 | güç |

Tekrar çıkan kart → değerinin %25'i jant iadesi.

**Neden iki tip?** Simülasyon ikisinin gerçekten farklı işe yaradığını
gösteriyor — hiçbiri diğerini ezmiyor:

| hedef | Temel (350j) | Nadir+ (800j) | direkt alım |
|---|---|---|---|
| 20 karta çık (ranked barajı) | **39 maç** | 110 maç | 44 maç |
| 3 destansı + 3 efsanevi | 205 maç | **106 maç** | 125 maç |

Yani: kart *sayısı* istiyorsan Temel, *güç* istiyorsan Nadir+, *belirli bir
kart* istiyorsan direkt alım. Üç alet, üç iş. Paketler ortalamada direkt
alımdan ~%12 ucuz; direkt alım da **kesinlik primi** olarak duruyor.

### Reddedilen: düşük oranlar (FUT tarzı)
"%0,1 destansı" önerildi. Simülasyon: tam koleksiyon **9,6 milyon jant =
74.000 maç.** Sebep, FUT'ta ~20.000 kart olması ve kovalamacanın hiç
bitmemesi; bizde 35 kart var ve **7 tanesi destansı.** Oran havuz boyutuna
ölçeklenmeli — 35 kartlık havuzda %3–17 doğru aralık. Havuz 100'e çıkarsa
oranlar yeniden sıkılaştırılabilir.

### Reddedilen: pakete özel kart ("legendary/diamond sadece paketten")
Üç sebeple:
1. [0008](0008-currency-model-and-server-stats.md)'in sözünü bozuyor —
   *"ödeme yapan ZAMAN satın alıyor, güç değil."* En güçlü kartlar sadece
   rastgele paketten çıkarsa, ücretsiz oyuncunun ulaşamayacağı bir güç oluşur.
   Tanımı gereği pay-to-win.
2. Runway'i yarıya indiriyor (25.200 jant ekonomiden çıkar, 515 → 321 maç) —
   tam olarak istenenin tersi.
3. Rastgele ödüllü kutu = loot box. Kitle 15–25, bir kısmı reşit değil;
   mağazalar oran yayınlamayı zorunlu tutuyor, bazı ülkeler kısıtlıyor.

**Kabul edilen alternatif:** prestij isteniyorsa **kozmetik** olsun — sahip
olunan kartın krom/animasyonlu varyantı, istatistik farkı sıfır. Statü var,
erişim kapısı yok.

### Reddedilen: FUT'un jant/coin çarpanı
FUT'ta paketin kazanılan para birimiyle fiyatı, gerçek para fiyatının ~200
katı. Bizde uygulansa jant paketi **354 maç** eder — basılmayan bir buton.

Daha önemlisi: **o çarpan bizde olmayan bir sorunu çözüyor.** FUT'ta transfer
marketi var, coin ile istediğin oyuncu doğrudan alınabiliyor; paket ucuz olsa
kimse gerçek para harcamaz. Bizde market yok, dolayısıyla tıkanacak kaçak da
yok. Bizde ödeme sebebi zaten var ve daha dürüst: **zaman.**

*(İleride kart takası eklenirse bu karar yeniden açılmalı — koşullu bir karar,
kalıcı değil.)*

**Kabul edilen ılımlı asimetri:** coin paketi kart başına ~%48 daha verimli
olsun. Ödeyen gerçek bir avantaj görür, jant paketi yine de açılabilir kalır.

## Karar 3 — Ranked barajı: 20 araç + 5 Pit Ekibi

En ucuz yol ≈ 5.085 jant ≈ **39 maç ≈ 2,3 saat** (Temel paketle).

Amaç: taze hesapların ranked'i doldurmasını engellemek ve oyuncunun ranked'e
girmeden önce oyunu öğrenmiş olması. Coinle atlanabilir olması **kasıtlı** ve
pay-to-win değil — alınan kartlar herkesin alabildiği kartlar, satın alınan şey
yine zaman.

Yan not: parayla hızlı girenler ranked'e sıfır tecrübeyle düşecek. Bu p2w değil
ama eşleşme kalitesi sorunu; çözüm ranked'e en alt kademeden başlatmak.

## Karar 4 — Runway içerikle uzatılacak, zamla değil

Havuz büyüklüğünün tek başına etkisi (hiçbir fiyata dokunmadan):

| araç | toplam | maç | saat |
|---|---|---|---|
| 35 (bugün) | 69.000 j | 532 | 31 |
| **50 (MVP hedefi)** | **88.800 j** | **684** | **40** |
| 100 | 154.800 j | 1.193 | 70 |

**MVP 50 araçla çıkacak.** Bir ara "fiyatları 2 katına çıkaralım mı"
tartışıldı; reddedildi çünkü zam sadece sonu değil **başı da** ikiye katlıyor
(ilk destansı 3 → 6 gün, rekabetçi kadro 13 → 26 gün) ve oyuncu 515. maçta
değil 20. maçta bırakır. İçerik eklemek aynı runway'i oyuncuyu cezalandırmadan
veriyor.

### Reddedilen: maç ödülünü düşürmek
Matematiksel olarak fiyat artırmakla birebir aynı (runway = toplam fiyat ÷ maç
başı ödül). Ama psikolojik olarak değil: **fiyat ara sıra hissedilir, ödül her
3,5 dakikada bir.** Aynı sonucu veren iki kaldıraçtan oyuncunun sürekli yüzüne
bakanı seçmenin sebebi yok.

**Kaldıraç sırası:** önce içerik (havuz) → sonra gerekirse üst uç fiyat ayarı →
ödül kesintisi en son çare.

## Karar 5 — Monetizasyonun ağırlığı kozmetiğe kayacak

Coin'in değeri **kalan işe** bağlı, toplam işe değil:

| kilometre taşı | oynayarak | oyuncu ne yapar |
|---|---|---|
| Ranked barajı | 2,3 saat | oynar |
| İlk destansı | 1,6 saat | oynar |
| Rekabetçi güç | 6,2 saat | bazıları öder |
| Tüm koleksiyon (50 kart) | 40 saat | asıl pazar |

Erken oyunda kimse ödemez — **ve ödememeli.** İlk saatinde ödeme baskısı yapan
oyun o oyuncuyu kaybeder. Baraj oyuncuyu içeri almak için var.

Asıl mesele şu: **kartların bir bitiş noktası var.** Oyuncu koleksiyonu
tamamladığında o musluk kapanıyor. Kalıcı gelir bitmeyen şeyden gelmeli:

1. **Kozmetik** (sahip olunan karta kaplama/efekt) — ücretsiz yolu yok,
   pay-to-win değil, tavanı yok.
2. **Sezon geçişi** — ucuz, tekrarlayan, her gün girme sebebi.
3. **Kart satışı** — üçüncü sırada, ve sadece geç oyuncuya.

**Kaçınılacak tuzak:** "kimse ödemiyor" diye erken oyunu acı verici hale
getirmek.

## Açık kalanlar

- **Coin'in gerçek para karşılığı** — bu ADR'deki bütün coin rakamları o oran
  belirlenene kadar soyut. Mağaza kesintisi ve fiyat basamaklarıyla birlikte
  ayrı ele alınacak.
- Kozmetik sisteminin tasarımı.
- Tur sayacının ve kopma penceresinin uygulanması (Faz 3, PvP ile).
- Paket uygulaması (mağaza ekranı gerekiyor).
