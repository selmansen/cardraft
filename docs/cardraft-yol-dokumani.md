# Proje Tasarım Dokümanı: Araç Temalı Kart Savaş Oyunu

## 1. Proje Özeti

**Tür**: Koleksiyon kartlı savaş oyunu (Hearthstone tarzı, "auto-battler" değil, strateji odaklı)
**Tema**: Araçlar (spor arabalar, monster truck'lar, vs.) — kurgusal isimler, gerçek marka/logo kullanılmayacak
**Hedef kitle**: 15-25 yaş (2026-09-12'de güncellendi; başlangıçta 5-20 yaş hedeflenmişti, kapsam genç yetişkine kaydı — bkz. §8)
**Platform**: iOS + Android (mobil)
**Teknoloji**: React Native + Expo (istemci; Faz 1 bu yığınla, Expo SDK 57, kuruldu ve oynanabilir durumda). Backend (Faz 2'den itibaren): Firebase ya da kendi sunucu/DB'si — henüz kesinleşmedi, bkz. §8.
**Geliştirme modeli**: Kod tamamen Claude tarafından yazılır, Selman çalıştırma/test/deploy adımlarını yürütür.


### Kritik kısıtlar / dikkat edilecekler
- **Marka/telif**: Gerçek araç markası isimleri/logoları KULLANILMAYACAK. Tüm araçlar kurgusal isimlerle (görsel olarak ilham alınabilir, isim/logo farklı olacak).
- **Çocuk güvenliği / mağaza uyumluluğu**: Serbest metin sohbet YOK. Sadece önceden tanımlı şablon mesaj + emoji sistemi var. Bu, hem çocuk güvenliği hem App Store/Google Play onay süreci açısından önemli.
- **Mesajlaşma kapsamı** (netleşen karar):
  - Birbirini arkadaş olarak eklemiş kullanıcılar arasında: şablon mesaj + emoji (serbest metin yok)
  - Random (rastgele eşleşen) oyunlarda: sadece şablon mesaj + emoji
  - Bot ile oynanan oyunlarda: sadece şablon mesaj + emoji (bota gönderilir, kozmetik/eğlence amaçlı)

---

## 2. Faz 1 — Çekirdek Oyun (İlk Hedef)

**Amaç**: Backend'siz, tek oyunculu, oynanabilir bir prototip. "Bu oyun eğlenceli mi?" sorusuna cevap bulmak.

### Kapsam
- Kart veri modeli: araç kartları (isim, güç/hız/dayanıklılık gibi basit stat'lar, görsel)
- Kart çeşitliliği: spor arabalar + monster truck'lar dahil, ilk aşamada sınırlı sayıda (örn. 15-20 kart) kurgusal araç
- Kart upgrade sistemi: temel seviye atlama (örn. seviye 1 → 2 → 3, stat artışı)
- Basit kart özellikleri/yetenekler (ilk aşamada karmaşık olmayan, temel etkiler)
- Savaş sistemi: **sadece bota karşı**, tur bazlı (turn-based) kart savaşı
- Görsel UI ve temel animasyonlar (kart açma, saldırı, upgrade efekti)
- Kart koleksiyonu / envanter ekranı, galeri
- Yerel veri saklama (cihaz üzerinde, hesap sistemi yok)
- Bot ile savaş sırasında şablon mesaj + emoji gönderme

### Faz 1'de OLMAYAN şeyler (bilinçli olarak erteleniyor)
- Hesap sistemi (misafir/gerçek kullanıcı)
- Arkadaşla veya random rakiple çevrimiçi savaş
- Sohbet/arkadaşlık sistemi
- Ekonomi: paket açma, günlük giriş ödülü, lig/rütbe (§8'de planlandı, henüz kodlanmadı)

### Faz 1 durumu (2026-09-12)
Çekirdek oyun oynanabilir: 35 araç kartı (7 kategori × 5), tur bazlı bota-karşı savaş,
sürükle-bırak saldırı, ses/müzik, zorluk seviyeleri, öğretici ekran. Üstüne yeni eklenen:
**Pit Ekibi** — sahaya çıkmayan, yakıt harcamayan destek kart türü (tam liste ve kurallar
§8.3'te). Kadro artık **araç + Pit Ekibi karışımı 8 kart** (en az 3 araç, en fazla 5 Pit
Ekibi — `src/store/gameStore.ts`daki `LOADOUT_TOTAL`/`MIN_VEHICLES`/`MAX_SUPPORT`).

---

## 3. Faz 2 — Hesap Sistemi ve Sosyal Temel

**Amaç**: Kullanıcıları tanımlamak ve arkadaşlık altyapısını kurmak.

### Kapsam
- Hesap/backend altyapısı: Firebase Auth+Firestore ya da Selman'ın kendi
  sunucusu+DB'si (2026-09-12'de gündeme geldi, henüz karar verilmedi — §8.5)
  - Misafir (anonymous) giriş
  - Gerçek hesap girişi (email / Google ile giriş)
  - Misafirden gerçek hesaba geçiş (veri kaybı olmadan)
- Kullanıcı verisi senkronizasyonu (kart koleksiyonu, ilerleme bulutta saklanır)
- **Sunucu taraflı günlük giriş takibi** (§8.1) — cihaz saatiyle hile edilemesin diye
  bilinçli olarak Faz 1'in yerel-storage'ına değil, buraya bağlandı
- Arkadaş ekleme sistemi (kullanıcı adı / kod ile arkadaş ekleme)
- Arkadaşla eşzamansız veya eşzamanlı savaş (teknik detay Faz 2 içinde netleştirilecek)
- Arkadaşlar arası şablon mesaj + emoji gönderme

---

## 4. Faz 3 — Çevrimiçi Rekabet ve Derinlik

**Amaç**: Oyunu canlı/sosyal bir deneyime taşımak.

### Kapsam
- **Lig/rütbe tabanlı random matchmaking** (Bronz→Şampiyon, Elo/LP mantığı — §8.2),
  kart gücünden/gold'dan bağımsız bir puana göre eşleştirir
- Gerçek zamanlı senkronize savaş sistemi (Firebase Realtime DB / Firestore listener ile,
  ya da özel backend'in eşdeğeri)
- Random oyunlarda şablon mesaj + emoji sistemi
- **Paket açma ekonomisi** (gacha, gerçek para dahil — §8.1/§8.4): görev, lig atlama,
  maç sonu ve doğrudan satın alma olmak üzere birden fazla kaynaktan paket
- İlerlemiş upgrade ve kart nadir seviyeleri (rarity tiers — Faz 1'de yıldız sayısı olarak zaten var)

---

## 5. Teknoloji Yığını (Tech Stack) Özeti

| Katman | Teknoloji | Notlar |
|---|---|---|
| İstemci (Client) | React Native + Expo (SDK 57) | Faz 1'de kuruldu ve oynanıyor; Expo Router (dosya tabanlı navigasyon) |
| Animasyon/gesture | react-native-reanimated 4 + react-native-gesture-handler | Sürükle-bırak saldırı, kart efektleri, ekran sarsıntısı vb. |
| Kart görselleri | Gerçek PNG/JPG asset'ler (`assets/cars/`, `assets/arena/`) | Prosedürel çizim (skia) fikri terk edildi, gerçek görsellere geçildi |
| Ses | expo-audio | SFX + savaş ekranı arka plan müziği (loop) |
| State yönetimi | Zustand + persist (AsyncStorage) | Kart koleksiyonu, kadro, oyun durumu; Faz 1'de yerel, Faz 2'de buluta taşınacak |
| Kimlik doğrulama | Firebase Auth **ya da** özel backend | Faz 2'de netleşecek (§8.5) — misafir + gerçek kullanıcı desteği |
| Veritabanı | Firebase Firestore **ya da** özel DB | Kart verisi, envanter, arkadaş listesi, lig puanı |
| Sunucu mantığı | Firebase Cloud Functions ya da eşdeğeri | Savaş doğrulama, hile önleme, günlük giriş damgası (Faz 2-3) |
| Gerçek zamanlı senkron | Firestore listeners / Realtime DB ya da eşdeğeri | Çevrimiçi savaş senkronizasyonu (Faz 3) |
| Geliştirme ortamı | Mac (Xcode + Android Studio + Node.js/nvm) | Hem iOS hem Android build alınabilir |

---

## 6. Açık Sorular / İleride Netleştirilecekler
- ~~Kart nadir seviyeleri (rarity) ve olasılık sistemi nasıl olacak?~~ Faz 1'de yıldız
  sayısına dayalı 4 kademe (common/rare/epic/legendary) olarak çözüldü.
- ~~Oyun içi ekonomi ücretsiz mi, IAP olacak mı?~~ Karar verildi: gerçek parayla paket
  satın alınabilecek (§8.1/§8.4), ama eşleştirme her zaman lig içi kalacağı için
  (§8.2) para tek başına galibiyet garantilemiyor.
- Çocuklara yönelik IAP/reklam kısıtlamaları (COPPA ve benzeri) artık daha az baskı
  altında — hedef kitle 15-25'e çekildi (§8'in başı) — ama loot-box'a dair ülke bazlı
  kısıtlamalar (örn. Belçika) gerçek para satışı canlıya çıkmadan önce tekrar
  gözden geçirilmeli, şu an bilinçli olarak ertelendi.
- Kart görselleri: Faz 1'de gerçek PNG/JPG asset'lere geçildi (`assets/cars/`,
  `assets/arena/`) — kaynak/lisans netleştirilmedi, ileride kendi üretim/AI görsel
  üretimi gündeme gelebilir.
- Backend seçimi: Firebase mi, Selman'ın kendi sunucusu/DB'si mi? (§8.5)
- Pit Ekibi kartlarının token ile ilişkisi: nasıl açılacaklar/yükseltilecekler? (§8.3)

---

## 7. Sonraki Adım
Faz 1 çekirdek oyun oynanabilir durumda (bkz. §2, "Faz 1 durumu"). Sıradaki iş: Pit Ekibi'nin
bota-karşı motorda cihazda test edilip dengesinin doğrulanması, ardından §8'deki
ekonomi katmanının (görev/paket/lig) Faz 2 backend'i üzerine inşa edilmesi.

---

## 8. Faz 2/3 Ekonomi & Meta-Oyun Planı (2026-09-12 tasarım kararları)

Faz 1 çekirdek oyunu tamamlandıktan sonra planlanan, FIFA Ultimate Team esintili
meta-oyun katmanı. Hedef kitlenin 15-25 yaşa çekilmesi (bkz. §1) bu kararların
arka planında: gerçek parayla paket satışı ve gacha mekaniği artık daha az
kısıtlayıcı bir çocuk-güvenliği baskısı altında değerlendirildi.

### 8.1 Görev, paket açma, günlük giriş
- **Günlük giriş**: Faz 2'nin kendi backend'i (Firebase ya da özel sunucu) üzerinden
  sunucu taraflı takip edilecek — cihaz saati oynatılarak hile edilmesin diye
  bilinçli olarak yerel depolamaya değil buraya bağlandı.
- **Paket açma (gacha) onaylı**, gerçek parayla da satın alınabilecek. Dengeleme:
  eşleştirme her zaman oyuncuyu kendi lig/rütbesine yakın rakiplerle eşleştirir
  (§8.2), yani para kart gücünü artırır ama otomatik galibiyet vermez.
- **Paketler temalı/garantili olacak**, tek tip değil: örn. "Spor Paketi" (kategori
  garantili), "Nadir Paketi"/"Efsanevi Paketi" (nadirlik garantili). Olasılık
  tabloları henüz netleşmedi.
- **Kazanım kaynakları çoklu** (FUT tarzı): belirli görevler paket hakkı verir, lig
  atlama paket ödülü verir, maç sonlarında rastgele küçük paket şansı olur, ayrıca
  doğrudan satın alma mümkün olacak.
- Ekonomi ilkesi: "ödüller bol keseden olmaz ama dengeli olmalı, hiçbir şey
  vermezsek oyunda tutamayız" — ne aşırı cömert ne aşırı cimri.

### 8.2 Lig/rütbe sistemi ve eşleştirme
- Bronz → Gümüş → Altın → Platin → Elmas → Şampiyon gibi kademeler (isimler taslak).
- **Elo/LP tarzı puan**: kazanınca +puan, kaybedince -puan (Valorant/LoL mantığı),
  kart gücünden/gold'dan bağımsız — sadece oyun içi gelişimi/skoru yansıtır.
- Eşleştirme bu puana göre yapılır, kadro değerine göre değil. Yan fayda: yeni bir
  oyuncu (Bronz) ile veteran bir oyuncu (zaten Elmas/Şampiyon'a tırmanmış) aynı
  havuzda karşılaşmaz — seviye/yükseltme sistemine ayrı bir "PvP normalize et"
  katmanı eklemeye gerek kalmadı, mevcut seviye 1→3 sistemi aynen kalıyor.

### 8.3 Pit Ekibi (destek kartları)
FIFA/atölye fikri pivot etti: araçlara gömülen parçalar yerine **ayrı bir kart
türü** oldu. Kadro artık **araç + Pit Ekibi karışımı, toplam 8 kart** (en az 3
araç, en fazla 5 Pit Ekibi — `LOADOUT_TOTAL`/`MIN_VEHICLES`/`MAX_SUPPORT`,
`src/store/gameStore.ts`). Bu mekanik Faz 1'in bota-karşı motoruna gömüldü
(`src/game/battleEngine.ts`, `src/data/supportCards.ts`), ekonomi beklemedi.

**Kaynak kuralı** (Pokémon TCG Pocket emsali): Pit Ekibi kartları yakıt harcamaz,
sahaya çıkmaz, turda en fazla 1 tanesi oynanabilir.

**11 kart**:

| Kart | Etki |
|---|---|
| Hızlı Tamir | Bir aracına anında can ver |
| Checkpoint | Garajına büyük miktarda can ver |
| Yedek Kalkan | Seçtiğin aracın bir sonraki hasarını yarıya indir |
| Feda Manevrası | Garaja gelen saldırıyı bir araca yönlendir |
| Pusu | Rakibin rastgele bir aracına ani hasar |
| Turbo Şarj | Bu tur +2 ekstra yakıt |
| Soğuk Başlangıç | Elindeki bir kartı bu tur ücretsiz oyna |
| Motor Arızası | Rakibin bir aracının bir sonraki saldırısını iptal et |
| Yol Kapama | Rakibin bir aracını 1 tur saldıramaz hale getir |
| Son Şans | 1 canı kalan aracını tam cana getir |
| Kafa Karıştır | Rakibin elindeki kartları desteye karıştırıp yeniden çektirir |

**Faz 1 durumu (2026-09-12, üçüncü geçiş — yerleşim kesinleşti)**: Şu an hepsi
baştan sahipli (kilit/token-ile-açma sistemi henüz yok). Yerleşim iki kez
değişti: önce Kadronu Düzenle içinde alt bölüm → kafa karıştırdı → ayrı ekran
(`Pit Ekibini Düzenle`, ayrı menü girişi) → bu da "olmadı gibi" bulundu (iki
farklı kart türü birbirinden çok kopuk hissettirdi). **Son karar**: TEK ekran
(`app/(main)/squad.tsx`), TEK menü girişi ("Kadronu Düzenle"), ama başlığın
hemen altında kategori sekmelerinden (Tümü/Spor Araba/...) görsel olarak
tamamen farklı, iri bir 2'li anahtar: **"Saha Ekibi | Pit Ekibi"**. Saha Ekibi
seçiliyken altında mevcut kategori sekmeleri + araç ızgarası, Pit Ekibi
seçiliyken destek kartı ızgarası çıkıyor. Kategori sekmeleri (araç alt-filtresi)
ile bu anahtar (kart TÜRÜ seçimi) bilinçli olarak aynı satırda/aynı bileşen
görünümünde DEĞİL — ikisi farklı eksenler, aynı görselde eşitmiş gibi durmaları
asıl kafa karışıklığının kaynağıydı. `pit-crew.tsx` silindi. `DEFAULT_SUPPORT_LOADOUT`
sadece başlangıç seçimi (2 kart), kilit değil. Zorluk ekranında (`app/(main)/difficulty.tsx`)
"Kadron: X araç + Y Pit Ekibi (Z/8)" rozeti ve savaşa başlarken 3 araçtan azsa
`Alert.alert` ile "Kadronu Tamamla" uyarısı hâlâ duruyor (bu kısım değişmedi).

**Etkileşim (2026-09-12, ikinci geçiş)**: İlk sürümde tap + hedef listesi paneliydi,
kullanıcı "sürükle bırak olsun, o bir kullanım alışkanlığı" dedi, drag-drop'a
çevrildi. Hedefsiz kartlar (target: 'none') araç kartlarıyla birebir aynı
"yukarı sürükle" jestini kullanıyor; hedefli kartlar board'daki attack-drag ile
aynı ghost/hit-test altyapısını paylaşıyor (aynı `dragOriginX/Y`/`dragTx/Ty`
shared value'ları, `EnemyVehicleCard`/`PlayerVehicleCard` artık ikisi de
`targetable`/`blocked` prop'u alıyor). Kart yüzü sadeleştirildi: ikon + isim +
"PİT" rozeti, tam açıklama artık `SupportInspectPanel`'de (uzun-bas ile açılır,
`InspectPanel` ile aynı görsel dil). Kök neden bulunan bir bug: destedeki kartlar
arasında z-index karışması vardı çünkü `SupportHandCard`'ın animasyonlu stilinde
`zIndex` hiç ayarlanmamıştı (vehicle `HandCard`'da olduğu gibi dinlenirken 1,
sürüklenirken 60) — eklenince düzeldi. Uzun-bas süresi 800ms→450ms düşürüldü
("çok uzun" geri bildirimi). "Pit Ekibi kartını kullanabilirsin" ipucu kaldırıldı
(kullanmak zorunlu değil, o izlenimi veriyordu).

**Araç yetenek dengelemesi TAMAMLANDI (2026-09-12)**: Tamir (REPAIR) ve Zırh
(ARMOR) tamamen kaldırıldı, yerine **Yıpratma (WEAR)** — sahada kaldığı her tur
sonunda rastgele bir düşman araca küçük hasar — ve **İkiz Vuruş (TWIN)** — aynı
turda iki kez saldırabilir — eklendi. 12 kart etkilendi (tam liste
`src/data/cards.ts`'te): Summit King, Velvet Roadster, The Heirloom, Ion Coupe,
Pulse GT, Singularity, Rescue Rig, Blaze Response, Guardian Hauler, Iron
Mammoth, Crane Titan, Demolition Rex. Kategori kimlikleri güncellendi (future:
"sürekli yıpratma + enerji boşalımı", utility: "hızlı iki müdahale + siper").
Bot skorlaması (`bot.ts`) ve `how-to-play.tsx`'in yetenek listesi de güncellendi.
**Not**: sayısal denge (attack/health değerleri) ilk elden mantıklı tahminlerle
yapıldı, gerçek denge cihazda oynanarak test edilmeli.

**Fikir (2026-09-12, henüz kararlaştırılmadı)**: Pit Ekibi kartları "kullandıkça
bitebilir" bir sisteme bağlanabilir — her kartın sınırlı sayıda kullanım hakkı
olur, tükenince token/coin ile "doldurulur". Bu hem §8.5'teki "token ile ilişkisi
ne olacak" sorusuna somut bir cevap olur hem de token'a sürekli bir harcama alanı
açar. Netleşmesi gereken noktalar: kullanım hakkı kart bazında mı sabit yoksa
nadirlik bazında mı değişken, tükenince kadrodan otomatik mi düşer yoksa sadece
o maç için mi kullanılamaz hale gelir, doldurma maliyeti ne kadar olacak.

Araç yetenekleriyle çakışmayı önlemek için **Tamir ve Zırh araçlardan kaldırılması,
yerine Yıpratma (sahada kalınca sürekli hasar) ve İkiz Vuruş (aynı turda iki kez
saldırı) eklenmesi** planlandı — bu, 35 kartlık havuzun ve "future"/"utility"
kategori kimliklerinin yeniden dengelenmesini gerektirdiği için ayrı bir iş
turunda ele alınacak, henüz kodlanmadı.

**Faz 1 kapsam sınırlaması**: Bot'un destesi henüz Pit Ekibi kartı içermiyor
(`makeBotLoadout`), yani bu tur sadece oyuncu tarafında oynanabilir. Bot AI'ının
bunları kullanması ayrı bir iş.

### 8.4 Para birimleri (taslak, netleşmedi)
- **Coin** (mevcut): sadece oynayarak kazanılır, kart açma/atölye gibi temel
  ilerleme için.
- **Gem/premium** (yeni): hem gerçek parayla hem az miktarda oynayarak kazanılır,
  sadece paket açmak için — coin'den ayrı tutulması, parayla alımın coin
  biriktirerek atlatılabilir olmasını (ve böylece anlamsızlaşmasını) önlüyor.
- **Token**: savaştan kazanılır; Pit Ekibi kartlarının açılması/yükseltilmesiyle
  ilişkisi henüz netleşmedi (§6).
- **Lig puanı (LP)**: harcanamaz, sadece rütbe/eşleştirme sinyali (§8.2).

### 8.5 Netleşmemiş noktalar
- Backend seçimi: Firebase mi, Selman'ın kendi sunucusu/DB'si mi?
- Kesin lig eşik/puan formülü (K-faktörü vb.)
- Pit Ekibi kartlarının token ile ilişkisi (açılış/yükseltme var mı? "kullandıkça
  biter, token ile doldurulur" fikri bir aday — bkz. §8.3 sonu)
- Paket olasılık tabloları
- Ülke bazlı loot-box uyumluluğu (şimdilik bilinçli olarak ertelendi, gerçek
  parayla paket satışı canlıya çıkmadan önce tekrar gözden geçirilmeli)
