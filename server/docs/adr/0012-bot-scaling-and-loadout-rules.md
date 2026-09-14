# 0012 — Bot ölçeklemesinin doğrulanması ve kadro kurallarının paylaşılması

**Durum:** Kabul edildi · 2026-09-14
**İlgili:** [0007](0007-server-side-match-verification.md) (maç doğrulama), [0009](0009-card-pricing-and-progression.md) (ilerleme temposu)

## Bağlam

Kart seviyesi sistemi kaldırılınca botu oyuncuyla birlikte güçlendiren kaldıraç
da gitmişti. Yerine nadirlik tabanlı bir ölçekleme yazıldı: oyuncunun
galibiyet sayısı arttıkça botun destesine üst nadirlikler giriyor.

Ölçekleme yazılmıştı ama **hiç ölçülmemişti**. "Zor hissettiriyor" bir denge
kanıtı değil; üstelik [0009](0009-card-pricing-and-progression.md)'un bütün
fiyat temposu tek bir sayıya dayanıyor: normal zorlukta oyuncunun kazanma
oranı. O sayı bilinmeden hiçbir fiyat gerekçelendirilemez.

Ölçmek için iki tarafı da aynı yapay zekânın oynattığı bir sanal maç koşucusu
yazıldı (`server/scripts/simulate-matches.mjs`). İlk sonuçlar anlamsızdı —
oyuncu hiçbir zorlukta kazanamıyordu. Sebep koşucudaydı: `planBotTurn` yalnızca
`state.bot` tarafını planlıyor, dolayısıyla oyuncu sırasında state aynalanmalı
ve **`active` alanı da çevrilmeli**; yoksa `playCard`/`attack` "sıra sende
değil" diye sessizce hiçbir şey yapmıyor ve planlayıcı donmuş bir state
üzerinde plan üretiyor. Düzeltilince gerçek tablo çıktı.

## Karar 1 — Botun kadrosu oyuncunun bütçesiyle aynı

Bot 6 araç + 3 pit = **9 kart** taşıyordu; oyuncunun bütçesi ise **8**. Deste
kadronun iki katı olduğu ve deste bitince yorgunluk hasarı başladığı için bu,
18'e 16 kart demekti.

Kâğıt üstünde küçük görünüyor. Ölçüm öyle demiyordu: düzeltme öncesi maçların
%20–60'ı yorgunluğa kadar gidiyordu ve yorgunluğu **önce oyuncu** görüyordu
(normal zorlukta %33'e %24). Yani uzun maçların bir kısmını bot, kimsenin
vermediği bir karar sayesinde kazanıyordu.

Bot artık 5 araç + 3 pit taşıyor.

**Fazlalık rastgele atılıyor, baştan/sondan değil.** İlk uygulamada "ilk 5'i
al" denmişti; küratörlü destelerin en nadir kartı listelerin sonunda durduğu
için bu, her destenin efsanevi kartını atmak — yani ölçeklemenin en üst
basamağını sessizce silmek — oluyordu. Hatayı testler yakaladı.

## Karar 2 — Kadro kuralları paylaşılan motorda, sunucu dayatıyor

`LOADOUT_TOTAL` / `MIN_VEHICLES` / `MAX_SUPPORT` yalnızca istemcideki
`gameStore`'da yazılıydı. Sunucu kadronun **boyutunu hiç doğrulamıyordu**:
DTO yalnızca her dizinin en fazla 8 olmasını kontrol ediyordu, toplamı
kontrol eden bir şey yoktu.

Yani değiştirilmiş bir istemci 8 araç + 8 destek gönderip **32 kartlık**
desteyle oynayabilirdi. Bot 16 kartta yorgunluğa düşerken karşısındakinin
destesi yarılanmamış bile olurdu — uzun maçlarda neredeyse garanti galibiyet,
ve maç doğrulaması bunu yakalayamazdı çünkü hamlelerin hepsi kurallara
uygundur.

Kurallar `game/loadoutRules.ts`'e taşındı ve `sync-engine` ile sunucuya
kopyalanıyor. `validateLoadout()` hem boyutu hem bileşimi hem de tekrarlanan
kartı reddediyor; hata **mesajını da** o fonksiyon döndürüyor, böylece
arayüzün gösterdiği kuralla sunucunun reddetme sebebi aynı cümle.

Bu, [0007](0007-server-side-match-verification.md)'nin devamı: orada "sonucu
istemci söylemez" denmişti, burada "kurulumu da istemci tanımlamaz" deniyor.

## Ölçüm

300 maç/hücre. Oyuncu tarafı sahip olduğu kartlardan rastgele kadro kuruyor
(desteyi özenle kurmayan bir oyuncu) ve hatasız oynuyor; bot zorluğun hata
oranıyla oynuyor.

| Zorluk | Oyuncu kazanma | Ort. tur |
|---|---|---|
| Kolay | %78–88 | ~19 |
| Normal | %43–55 | ~21 |
| Zor | %24–30 | ~20 |

İki taraf da küratörlü desteyle oynatıldığında (saf zorluk ayarı etkisi):
kolay %79, normal %44, zor %21.

**[0009](0009-card-pricing-and-progression.md)'un %65 varsayımı hakkında:**
ölçülen ~%49 daha düşük, ama ölçümdeki "oyuncu" küratörsüz bir desteyle ve
açgözlü bir planlayıcıyla oynuyor — gerçek bir insan desteyi düşünerek kurar.
%49 bu yüzden bir **alt sınır**. Ödül farkı da büyük değil: %49'da maç başına
ortalama 111 jant, %65'te 130 — destansı kart 32 maç yerine 28 maçta geliyor.
Fiyatlara dokunulmadı; oran gerçek oyuncu verisiyle tekrar bakılacak bir şey
olarak duruyor.

## Sonuç

- Ölçekleme çalışıyor ve eşikleri (3/10/25 galibiyet) satın alma gücüyle
  örtüşüyor: bot nadir kartları görmeye başladığında oyuncu da nadir kart
  alabiliyor.
- Denge artık ölçülebilir: `npm run simulate`.
- Kurallar tek yerde ve sunucu tarafından dayatılıyor.

## Açık kalanlar

- Simülasyondaki oyuncu bir insan gibi oynamıyor; gerçek kazanma oranı ancak
  canlı veriyle bilinecek. İlk yayından sonra maç sonuçları zaten sunucuda
  kayıtlı — oradan ölçülebilir.
- Kolay zorluk %80+ ile fazla cömert olabilir; ama kolay modun varlık sebebi
  yeni oyuncunun ilk maçlarını kazanabilmesiydi, o yüzden dokunulmadı.
