# Oyun navigasyonu — tasarım kaynağı

Canlı tuval: https://claude.ai/code/artifact/a45dd167-0466-4602-b12c-427ac293ce41

Uygulamaya "bir oyun" gözüyle bakıp alt menüyü ve ana ekranı yeniden kurgulayan
tasarım. Öncesinde menü, geldikçe satır eklenmiş bir liste hâlindeydi.

| Dosya | Ekran |
|---|---|
| `Main.dc.html` | Oyna — bağlı hesap |
| `OynaMisafir.dc.html` | Oyna — misafir hâli |
| `Garaj.dc.html` | Garaj — kadro + koleksiyon tek ekranda |
| `Profil.dc.html` | Profil — hesap, istatistik, ayarlar, hesabı sil |
| `MacSonu.dc.html` | Maç sonu — misafire giriş teklifi |
| `GirisEkrani.dc.html` | Giriş — dört vaat + Apple/Google |

## Kararlar

**Alt menü: `Garaj · Mağaza · [OYNA] · Lig · Profil`**
Merkez düğme oyunun kendisi; uygulama orada açılıyor, yani "ana ekran" ile
"oyna" ayrı iki sekme olmuyor. Eski menüdeki "Menü" sekmesi, içi başka
sekmelere giden satırlardan ibaret bir ara katmandı.

**Koleksiyon + Kadro → tek Garaj ekranı.**
Ayrıyken oyuncu koleksiyonda kart seçerken kadrosunu görmüyordu — körlemesine
deste kuruyordu. Kadro artık üstte sabit, koleksiyon altında kayıyor.

**Nasıl Oynanır ve ayarlar → Profil.**
Menüden iki satır eksiliyor, Profil de boş bir ekran olmaktan kurtuluyor.

**Lig sekmesi şimdiden var, "yakında" olarak.**
Sonradan eklenirse alt menü yeniden düzenlenir ve oyuncunun kas hafızası
bozulur. Sosyal (arkadaşlar) da bu sekmenin içinde iki bölüm olarak duracak.

**Misafirde Mağaza ve Lig kilitli görünüyor, gizli değil.**
Oyuncu neyi kaçırdığını görmeli; kilide dokunmak giriş ekranına götürüyor.

**Misafirin cüzdanı hiç gösterilmiyor.**
"0 jant / 0 coin" bilgi değil gürültü ve her açılışta bir şeyi olmadığını
hatırlatıyor. Yerine ne kazanacağını söyleyen tek bir şerit var.

## Kapsam dışı

- **Mesajlaşma.** Karar: yalnızca karşılıklı arkadaş olanlar arasında.
  Ama şimdilik hiç konmuyor — projenin sabit kısıtı "hiçbir yerde serbest
  metin yok" ve mesajlaşma o kısıtı açan ilk şey olur; moderasyon ve bildirme
  akışı gerektirir.
- **Lig ve arkadaşlar ekranlarının içi.** Faz 3, PvP dilimiyle.

## Yeniden üretmek

Üretilen tuval dosyası (`.html`) gitignore'lu. Kaynak bu klasördeki
`.dc.html` dosyaları; değişiklik onlarda yapılıp tuval yeniden üretiliyor.
