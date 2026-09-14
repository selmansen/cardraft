# 0013 — Paket açma: çekiliş sunucuda, tekrar koruması istemcinin kimliğiyle

**Durum:** Kabul edildi · 2026-09-14
**İlgili:** [0006](0006-server-authoritative-economy.md) (ekonomi), [0010](0010-pvp-timing-packs-and-monetisation.md) (paket modeli), [0011](0011-inventory-and-client-integration.md) (envanter)

## Bağlam

[0010](0010-pvp-timing-packs-and-monetisation.md) paket modelini belirlemişti
(tek kart, iki tip, oranlar, %25 tekrar iadesi) ama kod yoktu. Bu ADR onu
uygulayan kararları kaydediyor.

## Karar 1 — Oranlar ve fiyatlar paylaşılan motorda

`game/packs.ts`, `sync-engine` ile sunucuya kopyalanıyor. Mağaza ekranı
oranları oradan okuyup gösteriyor, sunucu da çekilişi oradan okuyup yapıyor.

İki kopya tutulsaydı ekranda "%17 destansı" yazarken sunucunun %3 ile
çekmesi mümkün olurdu — ve bu fark kimsenin göremeyeceği bir yerde, oyuncunun
aleyhine sessizce durabilirdi. Mağaza politikaları da yayınlanan oranla
gerçek oranın aynı olmasını zorunlu tutuyor: tek kaynak bunu yapısal olarak
garanti ediyor, disiplinle değil.

Oranların toplamının 100 ettiği modül yüklenirken doğrulanıyor
(`assertPackOdds`): 99 eden bir tablo çekilişte sessizce son nadirliğe kayar.

## Karar 2 — Çekiliş sunucuda, kriptografik üreteçle

İstemci çekseydi kazanan sonucu bulana kadar deneyip onu gönderebilirdi.

`Math.random` yerine `crypto.randomInt`: burada para söz konusu ve
öngörülebilir bir üreteç, sırayı bilen birine destansı kartın ne zaman
geleceğini hesaplatır. `randomInt` ayrıca modulo sapması olmayan tarafsız bir
aralık veriyor.

Aralık→nadirlik eşlemesi (`rarityForRoll`) motorda, rastgeleliğin kalitesi
serviste: kural test edilebilir kaldı, üreteç sunucunun sorumluluğunda.

## Karar 3 — Tekrar koruması istemcinin ürettiği `requestId` ile

Paket açmak geri alınamaz bir para hareketi ve sonucu rastgele. Mobil ağda
cevabın kaybolup istemcinin tekrar denemesi sıradan bir olay; korunmazsa
oyuncudan iki kez para düşer ve iki kart çekilir.

Kimliği **istemci üretiyor**, sunucu değil. Sunucu üretseydi her deneme yeni
bir açılış olurdu — korunması gereken şey tam olarak "aynı isteğin ikinci kez
gönderilmesi". `pack_openings` tablosunda `(userId, requestId)` benzersiz;
aynı kimlikle gelen ikinci istek yeni çekiliş yapmadan ilk sonucu döndürüyor.

Tablo ayrıca denge verisi: "hangi paketten ne çıktı", "kaç açılış tekrar karta
gitti". %25'lik iade oranının doğru olup olmadığı ancak gerçek açılış
verisiyle bilinebilir.

## Karar 4 — Havuz: araç kartları, başlangıç kartları hariç

**Pit Ekibi paketlerde yok.** Destek kartlarının fiyatı nadirliğe değil güç
seviyesine bağlı ([0009](0009-card-pricing-and-progression.md)), yani nadirlik
tablosuyla çekilemezler. Ayrıca 11 tane ve bilerek kıt tutuluyorlar; rastgele
dağıtmak o kıtlığı bozardı.

**Başlangıç kartları da havuz dışında.** Fiyatları 0 olduğu için çıktıklarında
iadeleri de 0 olurdu — oyuncunun eline hiçbir şey geçmeyen bir açılış.

## Karar 5 — Defterde harcama ve iade ayrı sebepler

`PACK_OPEN` ve `PACK_DUPLICATE_REFUND`. Tek sebeple yazılsaydı defterde net
rakam kalır, iade oranının gerçekte ne getirdiği ölçülemezdi.

## Ölçüm

600 açılış, gerçek sunucuya karşı:

| | ilan edilen | ölçülen |
|---|---|---|
| Sıradan | %60 | %61,7 |
| Nadir | %26 | %23,7 |
| Efsanevi | %11 | %11,7 |
| Destansı | %3 | %3,0 |

Cüzdan bakiyesi defterin toplamına eşit kaldı — paket açma
[0006](0006-server-authoritative-economy.md)'nın temel güvencesini bozmuyor.

**Tek açılışta kâr mümkün ve kasıtlı:** 350 jantlık Temel paketten tekrar
destansı kart çıkarsa 900 jant döner. Sızıntı olurdu ancak beklenen değer
fiyatı geçseydi; koleksiyonu tamamlamış bir oyuncu için beklenen iade Temel'de
161 jant (fiyat 350), Nadir+'ta 377 (fiyat 800). Yani "koleksiyonu tamamla,
sonsuz paket aç" bir jant üretme makinesi değil. Bir birim testi bu ilişkiyi
koruyor — oranlar ya da iade yüzdesi değişirse orada patlar.

## Açık kalanlar

- **Coin ile paket alımı.** Coin'in gerçek para karşılığı hâlâ belirlenmedi
  ([0010](0010-pvp-timing-packs-and-monetisation.md)); paketlerin `coin` fiyatı
  şimdilik 0 (= coin ile satılmıyor). Coin bütün satın alma akışlarına tek
  seferde eklenecek.
- Mağaza ekranı (tasarımı `docs/design/store/` altında, kod yok).
- Açılış geçmişini oyuncuya gösteren bir uç nokta — veri duruyor, arayüzü yok.
