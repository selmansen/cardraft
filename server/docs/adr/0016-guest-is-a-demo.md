# 0016 — Misafirlik bir deneme, ilerleme değil

**Durum:** Kabul edildi · 2026-09-15
**İlgili:** [0005](0005-guest-account-upgrade.md) (misafir yükseltme), [0015](0015-provider-only-auth.md) (sağlayıcı girişi), [0010](0010-pvp-timing-packs-and-monetisation.md) (paketler)

## Bağlam

[0015](0015-provider-only-auth.md) girişi tek dokunuşa indirdi ama misafir
hesap hâlâ değer biriktiriyordu: 300 jant hediye, maç ödülleri, satın alınan
kartlar. Bu, çözülmesi gereken bir sürü soru doğuruyordu — cihaz değiştiren
oyuncunun misafir ilerlemesi ne olacak, iki hesap nasıl birleşecek, hangi
durumda onay sorulacak.

Soruların hepsi tek bir varsayımdan geliyordu: **misafirin kaybedecek bir şeyi
var.**

## Karar — Misafirin cüzdanı 0, koleksiyonu başlangıç kartları

Misafir oyuncu maça girer, oynar, öğrenir. Kazanmaz, açmaz, biriktirmez.
İlerlemenin tamamı bağlı hesaba ait.

**Bu karar tek başına olsa kötü olurdu.** Koleksiyon oyununda ilerleme oyunun
kendisidir; onu bir kayıt formunun arkasına koymak oyuncu kaybettirir. Ama
[0015](0015-provider-only-auth.md) ile giriş tek dokunuşa indi — duvar artık
duvar değil. İki karar ayrı ayrı tartışılamaz, birlikte anlamlı.

### Ne kazandırdı

| Ortadan kalkan | Neden vardı |
|---|---|
| Hesap devralma onayı (409 + `force`) | Misafirin ilerlemesi silinmesin diye |
| "İlerleme var mı" ölçütü | Aynı sebeple |
| İki hesabı birleştirme sorusu | Hiç açılmadı, artık açılmayacak |

Yani bu karar kod eklemedi, **kod sildi**.

### Ne kazandırıyor (ürün tarafı)

Hikâye tek cümleyle anlatılabilir hâle geldi: *misafir = deneme, hesap =
oyun.* Oyuncuya ne kaybettiğini açıklamak da kolay — hiçbir şey, çünkü
biriktirmedi.

## Karar 2 — Hoş geldin hediyesi girişte, ve 350 jant

Hediye artık misafir açılışında değil, hesap **ilk kez bağlandığında**
veriliyor. Tutar 300'den **350**'ye çıkarıldı.

Sebep vaat ile deneyimin tutması: giriş ekranı oyuncuya "paketler aç" diyorsa,
giriş yaptıktan sonra ilk yapabileceği şey o olmalı. 300 jantla Temel pakete
(350) 50 jant yetişmiyordu — oyuncu girer, söz verilen şeyi yapamazdı. Bir
birim testi bu iki sayıyı birbirine bağlı tutuyor.

Ekonomiye etkisi tek seferlik 50 jant, yani ihmal edilebilir.

## Karar 3 — Misafir maçı ödülsüz ama SAYILIYOR

Maç yine sunucuda doğrulanıyor ve `battlesPlayed`/`battlesWon` artıyor. İki
sebeple: bot ölçeklemesi galibiyet sayısını okuyor
([0012](0012-bot-scaling-and-loadout-rules.md)) ve giriş teklifinin ne zaman
çıkacağı maç sayacına bağlı.

Geriye dönük ödül YOK. "Misafirken ilerleme yok" cümlesinin istisnası olsaydı
cümle de olmazdı; ayrıca tutar öngörülemez olurdu (maç başına ~130 jant) ve
defterde geriye dönük kayıt açmak gerekirdi.

## Karar 4 — Kural sunucuda dayatılıyor

`@AccountRequired()` + global guard: paket açma ve kart alma uçları misafire
**403** dönüyor.

Arayüzde düğmeyi gizlemek bir görgü kuralı, koruma değil — istemci
düzenlenebilir, uçlar doğrudan çağrılabilir. Misafirin bakiyesi zaten 0 olduğu
için "yetersiz bakiye" (400) de dönerdi, ama **o mesaj yanlış sebebi söyler**:
oyuncuyu jant aramaya iter, oysa yapması gereken giriş yapmak. 403 ve mesajı
doğru yönlendiriyor.

## Doğrulama

12 e2e testi: misafirin cüzdanı 0 · giriş yapınca 350 geliyor · ikinci
sağlayıcı bağlanınca hediye tekrarlanmıyor · misafir paket açamıyor ve kart
alamıyor (403, "giriş yapman gerekiyor") · misafir maçı doğrulanıyor.

## Açık kalanlar

- Değerlendirme ekranı (istemci): "araçlarını bul, paketler aç, lige katıl,
  arkadaşlarınla oyna" — giriş teklifinin gösterildiği yer.
- Teklifin tetikleyicileri: 5. maç sonrası diyalog, jant/coin göstergesine
  dokunma, koleksiyonda kilitli kart detayı.
- Misafirin maç ödülü göremediğini maç sonu ekranında nasıl söyleyeceğimiz —
  "giriş yapsaydın 170 jant kazanacaktın" dürüst ama sinir bozucu olabilir.
