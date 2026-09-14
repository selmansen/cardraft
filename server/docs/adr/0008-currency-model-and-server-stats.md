# 0008 — Para birimi modeli (jant / coin) ve istatistiklerin sunucuya taşınması

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
İki karar birlikte alındı çünkü aynı ilkeye dayanıyorlar: oyunun durumunu
belirleyen her şey sunucuda olmalı.

### Para birimi
Faz 1'de tek bir "coin" vardı ve oynayarak kazanılıyordu. Yol haritasında
gerçek parayla satın alma da vardı ama ikisinin ilişkisi tanımlı değildi.

Model olarak **League of Legends'ın "mavi öz / RP"** düzeni seçildi: bir kart
uzun uzun oynayarak da, para ödeyerek de alınabiliyor.

- **RIM** — oynayarak kazanılan. Arayüzde **"jant"** (araç temasının mavi özü).
  Kod tarafı İngilizce kalsın diye enum değeri RIM.
- **COIN** — gerçek parayla satın alınan. Yeni oyuncuda 0.
- **GEM kaldırıldı**: premium rolünü COIN üstlendi, iki premium para birimi
  tutmanın anlamı yoktu.
- **TOKEN da kaldırıldı**: bir süre "atölye/parça ekonomisi" için ayrılmıştı
  ama kazanılacağı bir yer hiç tanımlanmadı. Kullanılmayan bir para birimini
  şemada tutmak, her ekonomi sorgusunu ve her arayüz rozetini boşuna
  dallandırıyordu — ihtiyaç doğarsa geri eklenir.

Kurallar:
- Maç ödülü **her zaman jant**. Coin oynayarak ASLA kazanılmıyor — karıştırmak,
  ücretsiz oyuncunun premium para biriktirmesi demek olurdu ve satın almanın
  anlamını yok ederdi.
- Yeni hesap **300 jant** ile başlıyor; bu bonus da işlem defterine düşüyor
  (`SIGNUP_BONUS`), yani "bu 300 nereden geldi" ilk günden kayıtlı.
- Ödeme yapan **zamanı** satın alıyor, gücü değil: eşleştirme lig içinde
  kalacağı için para tek başına galibiyet getirmiyor.

### İstatistikler
`battlesPlayed` / `battlesWon` cihazda tutuluyordu. Bunlar sadece gösterilecek
rakamlar değil: **bot destesinin seviyesi galibiyet sayısına göre ölçekleniyor**
ve lig sistemi de buna dayanacak.

## Karar
Yeni `UserStats` tablosu. Sayaçlar **yalnızca doğrulanmış bir maç sonucuyla**
artıyor (`MatchService.submit` → `StatsService.recordBattle`), istemciden gelen
hiçbir veriyle değil.

## Gerekçe
Cihazda tutulsaydı oyuncu "0 galibiyet" yazıp sürekli en zayıf botla oynayarak
ödül toplayabilirdi. Sayının kendisi bir oyun mekaniğini beslediği an, o sayı
istemcinin yazabileceği bir yer olamaz.

Uygulama notları:
- `increment` kullanılıyor, "oku +1 yaz" değil: iki maç aynı anda sonuçlanırsa
  (iki cihaz) okuma tabanlı yaklaşım birini yutardı.
- Seri (`winStreak`) increment ile ifade edilemiyor (kaybedince sıfırlanmalı),
  o yüzden galibiyet/mağlubiyet ayrı yazılıyor.

## Bu turda kapanan bir borç
Zorluk ayarları ve bot desteleri sunucuda **elle yazılmış kopya** olarak
duruyordu. İlk gerçek denemede uydurma bir kart kimliği (`roadblock` ≠
`road-block`) yüzünden maç kurulumu patladı. Kopyalar silindi; `difficulty.ts`
ve `botDeck.ts` de motor senkronuna dahil edildi, artık istemciyle **aynı
dosyadan** geliyorlar. Kopya tutmak yerine tek kaynaktan almak o sınıf hatayı
tümden kaldırıyor.

## Doğrulandı
- Yeni oyuncu: 0 coin, **300 jant**, 0 token.
- Üç maç kazanıldı: jant 660 → 780 → 900, istatistik 3/3 → 5/5, seri 5.
- 5 galibiyetli oyuncu normal zorlukta **seviye 2** bot alıyor; sıfır
  galibiyetli oyuncu **seviye 1** — galibiyet sayısı gerçekten oyunu
  etkiliyor ve sunucudan geliyor.

## Kalan
- Kart fiyatları çift olmalı (jant fiyatı + coin fiyatı) — envanter dilimiyle.
- İstemcideki `gameStore` hâlâ kendi coin'ini tutuyor; istemci entegrasyonunda
  bu ekrandan okunan bir değere dönüşecek, doğruluk kaynağı sunucu olacak.
