# Değişiklik günlüğü — Mobil uygulama

Bu dosya **mobil uygulamanın** (Expo/React Native) sürüm geçmişi.
Sunucununki ayrı: [`server/CHANGELOG.md`](server/CHANGELOG.md).

Neden ayrı: ikisi ayrı yayınlanıyor. Sunucu haftada birkaç kez güncellenecek,
uygulama mağaza onayı yüzünden ayda bir. Tek günlük, tek numara ikisi hakkında
da yanlış bilgi verirdi. Bkz. [`docs/gelistirme-akisi.md`](docs/gelistirme-akisi.md).

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sürümleme [Semantic Versioning](https://semver.org/lang/tr/).
Etiket öneki: `app-v`.

## [Yayınlanmamış]

### Değiştirildi

- **Alt menü ve ana ekran oyun olarak yeniden kurgulandı:**
  `Garaj · Mağaza · [OYNA] · Lig · Profil`. Merkez düğme oyunun kendisi —
  uygulama orada açılıyor, yani "ana ekran" ile "oyna" ayrı iki sekme değil.
  Eski "Menü" sekmesi içi başka sekmelere giden satırlardan ibaret bir ara
  katmandı.
- **Koleksiyon ve Kadro tek Garaj ekranında birleşti.** Ayrıyken oyuncu
  koleksiyonda kart seçerken kadrosunu görmüyordu, yani körlemesine deste
  kuruyordu. Kadro artık üstte sabit, koleksiyon altında kayıyor.
- Zorluk seçimi Oyna ekranına taşındı (ayrı ekran kaldırıldı); "Nasıl
  oynanır" ve ayarlar Profil'e taşındı.

### Eklendi

- **Profil ekranı**: hesap durumu, sunucudan okunan istatistikler, ses ve
  otomatik tur ayarları, çıkış ve hesap silme.
- **Giriş ekranı**: misafire ne kazanacağını anlatan dört vaat ve Apple /
  Google düğmeleri. Bir duvar değil bir teklif — "şimdilik misafir kal" her
  zaman açık.
- **Maç sonunda misafire kaçırdığı ödül** gösteriliyor: rakam gerçek (aynı
  formül sunucuda çalışıyor), üstü çizili ve gri. "Misafir olarak devam et"
  bir kez seçilirse teklif bir daha çıkmıyor.
- **Lig sekmesi** yerini şimdiden aldı ("yakında"): sonradan eklenirse alt
  menü yeniden düzenlenir ve oyuncunun kas hafızası bozulurdu.

- Dal, sürüm ve yayın akışı: `develop`/`main` ayrımı, GitHub Actions CI,
  etiketle tetiklenen yayın. Bkz. `docs/gelistirme-akisi.md`.

- **Mağaza ekranı.** İki paket, çıkma oranları ve tek dokunuşla açılan oran
  detayı; bakiye yetmediğinde ne kadar kaldığını gösteren alt sayfa. Paket
  açma kendi ekranında: kapalı kart, açılış, sonuç (yeni kart ya da %25 jant
  iadesi). Oranlar istemcide sabit yazılı değil, sunucudan geliyor.

### Düzeltildi

- **Seçili araç kartının kenarı maviye dönüyordu ve kartın nadirlik kimliğini
  siliyordu** — destansı turuncu, nadir mavi, efsanevi mor diye kurulmuş bir
  sistem varken seçim anında hepsi aynı renge geliyordu. Kenar artık hiç
  değişmiyor; seçimi tik ve yükseltilmiş gölge anlatıyor, tik de kartın kendi
  renginde.
- **Kadroya alınan araç kartında hiçbir değişiklik olmuyordu.** `GameCard`
  seçimi `selected` prop'undan okuyordu ama çağıran `inSquad` gönderiyordu —
  iki prop aynı şeyi anlatıyor, biri seçim kipinde diğeri gezinme kipinde
  okunuyordu. Tek prop'a indirildi.
- Kadro şeridinde Pit Ekibi ikonu küçüktü ve çıkarma dairesi tamamını
  kapatıyordu; oyuncu hangi kartı çıkardığını göremiyordu.
- **Araç ve Pit kartlarının seçim işareti aynılaştı**: sağ üstte tik, seçili
  kenar rengi (araçta mavi, pitte mor). Araç kartında tik sol üstteydi ve
  seçilmemiş kartta da boş bir daire duruyordu — ızgaradaki her kartın üstünde
  bir işaret gözü yoruyordu.
- Pit kartının içeriği ortalandı, ikonu iki kat büyüdü: pit kartının nadirlik
  rengi ya da aracı yok, tanınmasını sağlayan tek görsel işaret o.
- **Pit kartının hızlı bilgisi de ortada açılıyor.** Alt sayfadan geliyordu;
  araç kartının aynı jesti (basılı tut) ortalı bir panel açıyor ve ikisinin
  farklı davranması iki ayrı mekanizma varmış gibi hissettiriyordu.
- **Pit Ekibi kartları eski tasarımına döndü**: mor (pembe değil), ikon →
  ad → etki → güç noktaları sırasıyla, köşede kilit/seçim rozetiyle.
  Sekmelerin ikonu ve kadro sayacı da geri geldi.
- **Kadro şeridi ekrana sığmıyordu** (8 yuva + ayraç 402 px'i aşıyor); artık
  yatay kayıyor. Sabit genişliğe sıkıştırmak yuvaları okunmaz hale getirirdi.
- **Kadrodan kart çıkarma işareti** köşedeki kırmızı rozetten kartın tam
  ortasındaki daireye taşındı (kırmızı, hafif saydam) — köşedeki rozet
  karttan çok dikkat çekiyordu ve şerit bir "sil" düğmeleri dizisi gibi
  duruyordu.
- "Savaşa Başla" yazısı hâlâ ortalı değildi ve üstten kırpılıyordu: elle
  verilen `lineHeight` Baloo 2'nin kendi satır dengesini bozuyor. Değer
  tamamen kaldırıldı.
- Alt gezinme çubuğu ekranın alt kenarına yapışık duruyordu (78 → 88 px).
- **Tipografi büyütüldü.** Gövde ölçeği beş basamaktan (11·12·13·14·15) üçe
  indi: `bodySmall` 14 · `body` 16 · `bodyBig` 18. En küçüğü artık 14 —
  eskiden rozet rakamları, nadirlik etiketleri ve ipucu metinleri telefonda
  okunmuyordu ve 11-12-13 arasındaki fark hiyerarşi kurmuyordu, sadece
  tutarsızlık üretiyordu.
- **Koleksiyon ızgarası iki sütuna indi.** Üç sütunda kart 108 px kalıyordu ve
  içindeki dört stat kutusu taşıp okunmaz oluyordu — kartın taşıdığı asıl
  bilgi görünmüyordu.
- **Kadro şeritlerinde kart görselleri yoktu** (Oyna ve Garaj), yalnızca
  nadirlik rengi vardı; oyuncu hangi aracı seçtiğini göremiyordu. İki ekran
  artık aynı bileşeni kullanıyor.
- **Saha Ekibi / Pit Ekibi ayrımı segment olarak geri geldi.** Filtre çipleri
  arasına konmuştu ama iki havuz gerçekten farklı: kart anatomisi, kadro
  sınırları ve kategori filtreleri ayrı.
- **Pit Ekibi kartlarının hepsi aynı anahtar ikonuyla gösteriliyordu**; artık
  yeteneğin türüne göre farklı ikon alıyorlar. Basılı tutunca da tam etkiyi
  gösteren alt sayfa açılıyor (ızgarada iki satıra sığmıyordu).
- Ana ekranda kadro "3 pit" yazısıyla bitiyordu; pit kartları da yuva olarak
  diziliyor.
- "Savaşa Başla" yazısı düğme içinde yukarı kayıyordu (Baloo 2'nin iç boşluğu).
- **Uygulama artık "nasıl oynanır" ekranıyla açılmıyor.** Oynamaya gelen
  oyuncuyu okumaya zorluyordu; kurallar Oyna ekranındaki bir satırda ve
  Profil'de duruyor.

### Değiştirildi (görünüm)

- **Diyaloglar uygulamanın kendi tasarımında.** `Alert.alert` işletim
  sisteminin diyaloğunu açıyordu: iOS'ta sistem fontu ve mavi düğmeler —
  oyunun ortasında başka bir uygulama açılmış gibi duruyordu. Beş ekrandaki
  tüm onaylar artık `DialogProvider` üzerinden.
- **Alt sayfaların animasyonu düzeldi.** Karartma panelle birlikte aşağıdan
  yukarı kayıyordu (ekranın altından siyah bir blok geliyormuş gibi); artık
  karartma soluyor, panel kayıyor.

- **Çevrimdışıyken bakiye ekrandan ekrana farklı görünüyordu.** Menü yerel
  bakiyeyi gösteriyor, Kadro / kart detayı / mağaza ise doğrudan sunucu
  değerini okuduğu için **0 jant** gösteriyordu. Koleksiyon için yazılmış
  `useCollection` kancasının cüzdan karşılığı yoktu; `useWallet` eklendi ve
  dört ekran da ondan okuyor.
- Menüdeki "Garajında X / 35 araç" sayısı sabit yazılıydı; kart havuzu
  büyüdüğünde sessizce yanlış olacaktı. Artık katalogdan geliyor.
- Maç sonunda gösterilen ödül artık sunucunun bildirdiği miktar.

- **Bot, oyuncudan bir kart fazla taşıyordu.** Kadro bütçesi 8 kart ama botun
  destesi 6 araç + 3 pit'ten kuruluyordu. Deste kadronun iki katı ve deste
  bitince yorgunluk hasarı başladığı için bu, uzun maçlarda bota bedava
  avantaj veriyordu — ölçümde yorgunluğu önce oyuncu görüyordu. Bot artık
  oyuncuyla aynı bütçeden oynuyor (5 araç + 3 pit).
- Kadro kuralları (8 kart, en az 3 araç, en fazla 5 pit) paylaşılan motora
  taşındı; artık sunucu da aynı kuralı dayatıyor.

## [0.1.0] — 2026-09-14

İlk sürüm — Faz 1 prototipi ve Faz 2 sunucu entegrasyonu.

### Eklendi

- Sıra tabanlı savaş: sürükle-bırak saldırı, yakıt ekonomisi, 8 yetenek.
- 35 araç kartı (7 kategori) + 11 Pit Ekibi destek kartı.
- Açık tema tasarım sistemi v2 (Baloo 2 + Nunito, "chunky" bileşenler).
- Kolay/Normal zorluk, öğretici ekran, uzun-bas kart inceleme.
- Ses (müzik + efekt) ve arena görselleri.
- Sunucu bağlantısı: misafir giriş, cüzdan, koleksiyon, maç doğrulama.
  Çevrimdışı oynanabiliyor ama ödül vermiyor.
