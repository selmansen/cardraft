# 0011 — Envanter sunucuya taşındı ve istemci API'ye bağlandı

**Durum:** Kabul edildi · 2026-09-14
**İlgili:** [0006](0006-server-authoritative-economy.md) (ekonomi), [0007](0007-server-side-match-verification.md) (maç doğrulama), [0009](0009-card-pricing-and-progression.md) (fiyatlar)

## Bağlam

[0009](0009-card-pricing-and-progression.md) fiyatları belirledi ve ödüller
[0006](0006-server-authoritative-economy.md) ile sunucuya taşınmıştı. Ama
harcama hâlâ cihazdaydı: `gameStore.unlockCard` yerel bir sayıdan düşüyordu.

Bu ikisi bir arada duramaz. Ödül sunucuda yazılıp harcama cihazda yapılırsa
oyuncunun gördüğü bakiye hiçbir zaman doğru olmaz — kazandığı jant sunucuda
birikir, harcadığı jant cihazdan düşer ve iki sayı ilk maçtan itibaren
ayrışır. Yani envanter dilimi "sonra yaparız" olmaktan çıkıp kritik yola
girdi.

## Karar 1 — Koleksiyon veritabanında, katalog kodda

`OwnedCard` tablosu: kullanıcının sahip olduğu kartlar. `(userId, cardId)`
benzersiz.

Ama **kart kataloğu (isim, nadirlik, fiyat) veritabanına GİRMEDİ.** Katalog
senkronlanan motorda (`game-engine/data/cards.ts`) kalıyor ve sunucu
`card-catalog.ts` üzerinden okuyor.

Gerekçe: kart tanımları oyunun **kurallarının** parçası ve maç doğrulaması
tam olarak aynı tanımları görmek zorunda. Fiyatları ayrıca veritabanına
yazsaydık iki doğruluk kaynağı olurdu; biri güncellenip diğeri unutulduğunda
oyuncu yanlış fiyat öderdi. Bu, ödül miktarlarında bir kez yaşadığımız hatanın
aynısı (bkz. ADR 0009, "tek kaynak" bölümü).

`OwnedCard.cardId` bu yüzden yabancı anahtar değil, düz metin.

## Karar 2 — `EconomyService.move` dış transaction'a katılabiliyor

"Parayı düş, sonra kartı ver" iki ayrı transaction olsaydı, arada bir hata
oyuncunun parasını kaybedip kartı alamamasına yol açardı.

`move`'a opsiyonel bir `outer: PrismaTx` parametresi eklendi. Alternatifler ve
neden seçilmedikleri:

- **Ödeme sonra, telafi gerekirse geri al**: telafi kodunun kendisi de
  başarısız olabilir; "geri alma" yolu test edilmeyen bir yol olur.
- **Sadece idempotency anahtarına güven**: tekrar denemede çift tahsilat
  olmaz ama istemci hiç tekrar denemezse oyuncu parasız ve kartsız kalır.
- **Katılabilen transaction**: tek atomik birim, telafi kodu yok.

Sıralama da kasıtlı: **önce kart satırı, sonra ödeme.** Benzersizlik kısıtı
"zaten sahip" durumunu veritabanı seviyesinde yakalıyor, yani kontrol ile
ekleme arasında yarış koşulu kalmıyor. Yetersiz bakiyede transaction geri
alınıyor ve kart satırı da yok oluyor.

Doğrulandı: aynı karta 10 eşzamanlı istek → 1 başarılı, 300 jant bir kez
düştü. 4 farklı karta eşzamanlı istek, 300 jant → 1 başarılı.

## Karar 3 — `installationId`'yi SUNUCU üretiyor

Bu bir güvenlik düzeltmesi.

`POST /auth/guest`, bilinen bir `installationId` ile o misafir hesabın
token'larını döndürüyor. Yani **installationId fiilen bir giriş anahtarı** ve
tahmin edilemez olmak zorunda.

İstemcide kriptografik rastgelelik yok: React Native/Hermes
`crypto.getRandomValues` sağlamıyor ve `Math.random` bir kimlik anahtarı için
uygun değil (durumu gözlemlenebilirse çıktıları tahmin edilebilir).

Seçenekler:
- **`expo-crypto` eklemek**: doğru ama yeni bağımlılık kurulumu gerektiriyor
  ve istemci o kurulum yapılana kadar çalışmıyor.
- **Sunucunun üretmesi**: `node:crypto.randomUUID`. Sunucuda zaten güvenilir
  rastgelelik var, istemcinin rastgelelik kalitesi denklemden tamamen çıkıyor.

İkincisi seçildi. `installationId` yalnızca `GuestLoginDto`'da opsiyonel
(mapped-types ile: `OmitType` + `PartialType(PickType(...))`, böylece uzunluk
kuralları kopyalanmıyor). Boş gelirse sunucu üretip yanıtta döndürüyor,
istemci saklıyor. Geriye dönük uyumlu: kimlik gönderen istemciler çalışmaya
devam ediyor.

## Karar 4 — Kadroyu istemci SEÇER, sunucu DOĞRULAR

`MatchService.open` artık kadrodaki her kartın gerçekten sahip olunduğunu
kontrol ediyor. Bu, `OpenMatchDto`'daki "Faz 2 geçiş dönemi" borcunu kapatıyor.

Seçim ile sahiplik farklı şeyler: hangi kartlarla oynayacağı oyuncunun
tercihi, o kartlara sahip olup olmadığı bir gerçek. Kontrol olmadan istemci
hiç açmadığı destansı kartlarla maça çıkabilirdi.

Kadro ayrıca donduruluyor: doğrulama maç açılırkenki kadroyla yapılıyor,
oyuncu maç ortasında değiştiremiyor.

## Karar 5 — Çevrimdışı oynanır, ama ödül vermez

Sunucuya ulaşılamazsa maç yerel kurulumla oynanıyor (`matchSession.ts`
içindeki `offline()`), `matchId` null oluyor ve **jant yazılmıyor**. Sonuç
ekranında "Çevrimdışı maç — jant kazanılmadı" görünüyor.

Alternatif olarak maçları kuyruklayıp sonra doğrulatmak düşünüldü. Şimdilik
yapılmadı çünkü tohumu sunucu veriyor: çevrimdışı oynanan bir maçın sunucuda
karşılığı yok. İleride "bilet" modeli (çevrimiçiyken önceden tohum alıp
çevrimdışı harcamak) bunu çözebilir.

Kart açmak çevrimdışı hiç mümkün değil — bakiye de koleksiyon da sunucuda.
Butonlar pasif ve sebebi yazıyor.

## Karar 6 — İstemcide tek "sahip miyim" kaynağı

`useVehicleCollection()` / `useSupportCollection()`: çevrimiçiyken sunucudan,
değilken yerel önbellekten okuyor. Dört ekran aynı dallanmayı ayrı ayrı
yazsaydı, biri unutulduğunda o ekran sessizce yanlış koleksiyonu gösterirdi.

Yerel kopya `refreshInventory` sırasında sunucudan güncelleniyor. Olmasaydı,
çevrimiçiyken 10 kart açan oyuncu bağlantısı kesildiğinde sadece 6 başlangıç
kartını görürdü — açtıkları kaybolmuş gibi.

Yerel listeye düşmek güvenlik açığı değil: o liste yalnızca NE GÖSTERİLECEĞİNİ
belirliyor, maça çıkarken sahiplik zaten sunucuda doğrulanıyor (Karar 4).

## Karar 7 — Token yenileme tek uçuşlu

Refresh token rotasyonlu: her yenilemede eskisi iptal ediliyor. Açılışta üç
istek birden 401 alıp üçü de ayrı yenileme başlatsaydı, ilki başarılı olur ve
diğer ikisi artık iptal edilmiş bir token'la denerdi — kullanıcı sebepsiz
oturumdan atılırdı. İlk yenileme sözü paylaşılıyor.

Ayrıca: yenileme **ağ hatasıyla** başarısız olursa oturum SİLİNMİYOR (kullanıcı
sadece çevrimdışı), ama sunucu **reddederse** siliniyor (oturum gerçekten
bitmiş).

## Yan düzeltme: bot ölçeklemesi hiç çalışmıyormuş

`makeBotLoadout()` hem istemcide hem sunucuda **parametresiz** çağrılıyordu,
yani varsayılan `battlesWon = 0` ile — bot her zaman en düşük kademede
oynuyordu ve ADR 0009'da tasarlanan ilerlemeye göre ölçekleme hiç devreye
girmiyordu.

Sunucu tarafında galibiyet sayısı artık `StatsService`'ten okunuyor (istemciden
gelseydi oyuncu "0 galibiyetim var" deyip hep en zayıf botla oynardı). Destek
kartı havuzu da aynı merdivene bağlandı.

Ders: varsayılan değerli bir parametre, çağrıyı unuttuğunda **hata vermiyor** —
sessizce yanlış davranıyor. Tasarım kararının kodda karşılığı olduğunu
varsaymak yerine çalıştırıp doğrulamak gerekiyor.

## Doğrulama

Hepsi çalışan sunucuya karşı gerçek isteklerle:

- Misafir giriş → sunucu `installationId` üretti → aynı kimlikle tekrar giriş
  aynı hesaba döndü.
- Yeni hesap: 300 jant, 0 coin, 6 araç + 3 Pit Ekibi.
- Refresh rotasyonu çalışıyor; eski token ikinci kullanımda 401.
- Sahip olunmayan kartla maç açma → 400.
- Tam sınır: 300 jant / 300 jantlık kart → başarılı, bakiye 0.
- Aynı kart ikinci kez → 400, para düşmedi.
- Olmayan kart → 404. Başlangıç kartı → 400.
- Eşzamanlılık: 10 istek → 1 satın alma.
- **18 maçlık tam döngü: 18/18 sunucu doğrulaması istemciyle birebir tuttu**,
  1980 jant birikti, 1800'lük efsanevi kart açıldı, yeni kartla maç açıldı.
- `expo export` ile iOS paketi temiz derlendi.

## Açık kalanlar

- Kadro (`loadout`) hâlâ sadece cihazda: hangi kartla oynayacağı tercihi
  sunucuda tutulmuyor. Cihaz değiştiren oyuncu kadrosunu yeniden kurar.
- `expo-secure-store`'a geçiş: token'lar şu an AsyncStorage'da (şifresiz).
  `src/api/tokens.ts` bu geçişi tek dosyaya kapatıyor.
- İstemci API tipleri elle yazılmış kopya (`src/api/types.ts`). Motor için
  `sync-engine.mjs` var, API tipleri için benzeri gerekecek.
- Çevrimdışı maçlar için "bilet" modeli.
- e2e test paketi: doğrulamaların tamamı elle script'lerle yapıldı, otomatik
  koşan bir paket yok.
