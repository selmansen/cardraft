# Savaş kartları — tasarım kaynağı

Canlı tuval: https://claude.ai/code/artifact/27ecdedd-fb5a-44eb-a05c-4501742df3f9

Savaş ekranındaki kartların (eldeki deste ve sahadaki araçlar) stat yerleşimi,
renkleri ve durum işaretleri. Öncesinde iki kart da küçük, ikonsuz ve savaş
ekranına özel uydurulmuş bir palet kullanıyordu.

| Dosya | İçerik |
|---|---|
| `Main.dc.html` | Rozet dili + el kartının dört nadirlikteki hâli |
| `Oynanabilirlik.dc.html` | Oynanabilir kart işareti — A / B / C seçenekleri |
| `SahaKarti.dc.html` | Saha kartı, hazır/yorgun ve yan yana karşılaştırma |
| `SavasEkrani.dc.html` | Hepsinin bağlamı: tam savaş ekranı |

## Kararlar

**Stat renkleri kart detay sayfasından geliyor.**
Güç turuncu (`accent`), hız mavi (`primary`), dayanıklılık yeşil (`success`),
yakıt lacivert (`primaryInk`). Savaş ekranına ayrı bir palet uydurmak,
oyuncunun kart detayında öğrendiğini savaşta yeniden öğrenmesi demekti.

**Rozette ikon filigran, rakam üstte.**
30 px'lik bir rozette ikon ve rakam yan yana sığmıyor; ikon küçülünce de
okunmuyordu. Üst üste konunca ikon dokuya dönüşüyor, rakam tam boy kalıyor.
Gölge (`0 1px 2px rgba(0,0,0,.55)`) parlak dolgu üzerindeki beyaz rakamı
okunur tutuyor.

**Elde yalnızca yakıt, sahada güç · hız · dayanıklılık.**
Her ekran kendi sorusunu soruyor: elde "bunu şimdi oynayabilir miyim",
sahada "kim kimi devirir". Yakıt sahaya çıkan kartta hiçbir kararı
etkilemiyor, maliyeti çoktan ödendi. Dörtten üçe inince rozet 23 → 30 px
büyüdü; en dar ekranda (84 px kart) bile 26 px kalıyor.

**Nadirlik savaşta da görünüyor.**
Kenar, ad şeridi ve yıldızlar `theme.ts`'teki gerçek nadirlik paletinde.
Eskiden savaşta kartın ne kadar değerli olduğu hiç okunmuyordu — oysa
"bunu şimdi harcayayım mı" kararı tam olarak buna bağlı.

**Durum kenarda değil, kartın dışındaki halkada.**
Yeşil halka her yerde aynı şeyi söylüyor: elde "bunu oynayabilirsin",
sahada "bu araç saldırabilir". Mavi = bırakılırsa oynanacak, kırmızı =
sürüklenen kartın geçerli hedefi. Kenar böylece kalıcı kimlik olarak
nadirliğe kalıyor.

**Soluklaştırma kaldırıldı.**
Soluk kart bozuk/yükleniyor gibi okunuyor, üstelik nadirlik rengini de
söndürüyordu. Oynanamayan karta dokunulduğunda zaten nedenini söyleyen bir
uyarı çıkıyor.

## Kapsam dışı

- **Yakıtın ne kadar eksik olduğunu göstermek** (tuvaldeki B seçeneği,
  rozette `-3`). Her turda elin yarısı kırmızı görünüyordu. Gerekirse
  yalnızca o karta dokunulduğunda gösterilir.

## Cihazda bakılacak

- Rakip ve oyuncu kartları artık kenar renginden ayrılmıyor; ayrım sahadaki
  şeritten geliyor. Yetersiz gelirse rakip matı koyulaştırılır.
- Filigran ikon %30 opaklıkta; en küçük rozette (26 px) rakamın arkasında
  gürültü yaparsa %22'ye inebilir.
- Ad şeridi 12 px: uzun adlar üç noktayla kesiliyor.

## Yeniden üretmek

Üretilen tuval dosyası (`.html`) gitignore'lu. Kaynak bu klasördeki
`.dc.html` dosyaları; değişiklik onlarda yapılıp tuval yeniden üretiliyor.
