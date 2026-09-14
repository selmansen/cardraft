# 0007 — Maçın sunucuda doğrulanması (deterministik yeniden oynatma)

**Durum:** Kabul edildi · 2026-09-13
**Yerine geçtiği:** ADR 0006'daki "saatlik ödül tavanı" önlemi (kaldırıldı)

## Bağlam
Oyun çevrimdışı oynanabiliyor. İlk çözümde ödül miktarını sunucu belirliyordu
ama "maçı kazandım" bilgisi istemciden geliyordu — yani hiç oynamadan ödül
istemek mümkündü. Buna karşı saatlik bir tavan konmuştu; o bir **hasarı
sınırlama** önlemiydi, hileyi engellemiyordu ve meşru oyuncuyu da
cezalandırıyordu.

## Karar
Maçın sonucunu sunucu **kendi hesaplıyor**:

1. `POST /matches` — sunucu bir **tohum** üretir, bot kadrosunu ve zorluk
   ayarlarını kendisi seçip veritabanına dondurur.
2. İstemci o tohumla oynar.
3. `POST /matches/:id/submit` — istemci **yalnızca kendi hamlelerini**
   gönderir. Gövdede "kazandım" diye bir alan yoktur.
4. Sunucu aynı tohum ve aynı kurulumla maçı **baştan oynatır**, botu her turda
   kendisi planlar, kazananı bulur.
5. Ödül, sunucunun kendi sonucuna göre yazılır.

## Bunu mümkün kılan şey
Oyun motoru (`src/game/battleEngine.ts`) en baştan **saf ve UI'dan bağımsız**
yazılmıştı. Tek eksik determinizmdi; iki kaynak rastgelelik state dışındaydı:

- **`Math.random()`** (deste karma, botun hedef seçimi, "hata yapma" kararı)
  → tohumdan türeyen RNG'ye taşındı (`src/game/rng.ts`), durum `state.rngState`
  içinde yaşıyor.
- **Kart kimlikleri** modül düzeyinde bir sayaçtan üretiliyordu; aynı süreçte
  kaç maç açıldığına göre kayıyordu. Sunucuda araçlar farklı uid alınca
  istemcinin "pv-3 ile saldırdım" hamlesi hiçbir araca denk gelmiyor, hamle
  sessizce hiçbir şey yapmıyor ve maç "sonuçlanmadı" görünüyordu. Sayaç da
  `state.uidCounter`'a taşındı. **Bu, ilk denemede yakalanan gerçek bir
  hataydı** — determinizmin yalnızca RNG meselesi olmadığının kanıtı.

## Gerekçe
- **Botu istemci göndermiyor, sunucu planlıyor:** aksi hâlde "bot hiç
  saldırmadı" gibi bir maç uydurulabilirdi.
- **Geçersiz hamleler ayrıca kontrol edilmiyor:** motor zaten geçersiz hamlede
  state'i değiştirmiyor. "Elimde olmayan kartı oynadım" iddiası sunucuda
  hiçbir şey yapmıyor ve maç oyuncunun umduğu gibi gitmiyor.
- **Tohumu sunucu veriyor:** istemci kendi tohumunu seçebilseydi, kazandığı bir
  tohum bulana kadar deneyip onu oynardı.
- **Kurulum donduruluyor:** doğrulama, maç açılırkenki kadro ve zorlukla
  yapılmak zorunda; sonradan değiştirilmesi maçı yeniden üretilemez kılardı.

## Doğrulandı
- Hiç hamle yapmadan "bitti" → reddedildi ("Maç sonuçlanmadı").
- Olmayan kart/araçla hamle → reddedildi.
- Gerçekten oynanmış maç → sunucunun bağımsız hesabı istemciyle **aynı**
  sonucu verdi (kazandı, 9 tur), ödül yazıldı.
- Aynı maçı tekrar gönderme → "zaten sonuçlandı", bakiye 120'de kaldı.
- Reddedilen maçlar `REJECTED` olarak sebebiyle kaydediliyor (inceleme için).

## Sonuçları
- Ödül artık tavana ihtiyaç duymuyor: doğrulanmış bir sonucu sınırlamanın
  anlamı yok.
- Motor iki tarafta da çalışmak zorunda. Tek kaynak `src/game`; sunucuya
  `npm run sync:engine` ile kopyalanıyor (üretilen çıktı, gitignore'lu).
  İdeali paylaşılan bir workspace paketi; Expo/Metro tarafını kırma riski
  olduğu için ertelendi.
- **Kalan açık:** istemci hâlâ *kötü oynanmış* bir maçı gönderebilir (kasten
  kaybetmek). Bunun bir zararı yok — ödül zaten sonuca göre.
