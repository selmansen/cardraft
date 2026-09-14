# Proje Tasarım Dokümanı: Araç Temalı Kart Savaş Oyunu

## 1. Proje Özeti

**Tür**: Koleksiyon kartlı savaş oyunu (Hearthstone tarzı, "auto-battler" değil, strateji odaklı)
**Tema**: Araçlar (spor arabalar, monster truck'lar, vs.) — kurgusal isimler, gerçek marka/logo kullanılmayacak
**Hedef kitle**: 5-20 yaş arası çocuklar ve gençler
**Platform**: iOS + Android (mobil)
**Teknoloji**: React Native + Expo (istemci), Firebase (backend — Faz 2'den itibaren)
**Geliştirme modeli**: Kod tamamen Claude tarafından yazılacak, kullanıcı (Selman) çalıştırma/test/deploy adımlarını yürütecek. Mac üzerinden Claude Desktop ile devam edilecek.


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
- Ekipman/buff sistemi

---

## 3. Faz 2 — Hesap Sistemi ve Sosyal Temel

**Amaç**: Kullanıcıları tanımlamak ve arkadaşlık altyapısını kurmak.

### Kapsam
- Firebase Auth entegrasyonu:
  - Misafir (anonymous) giriş
  - Gerçek hesap girişi (email / Google ile giriş)
  - Misafirden gerçek hesaba geçiş (veri kaybı olmadan)
- Firestore ile kullanıcı verisi senkronizasyonu (kart koleksiyonu, ilerleme bulutta saklanır)
- Arkadaş ekleme sistemi (kullanıcı adı / kod ile arkadaş ekleme)
- Arkadaşla eşzamansız veya eşzamanlı savaş (teknik detay Faz 2 içinde netleştirilecek)
- Arkadaşlar arası şablon mesaj + emoji gönderme

---

## 4. Faz 3 — Çevrimiçi Rekabet ve Derinlik

**Amaç**: Oyunu canlı/sosyal bir deneyime taşımak.

### Kapsam
- Random matchmaking (rastgele rakiple eşleşme)
- Gerçek zamanlı senkronize savaş sistemi (Firebase Realtime DB / Firestore listener ile)
- Ekipman/buff sistemi (kartlara "bir şey takarak" güçlendirme)
- Random oyunlarda şablon mesaj + emoji sistemi
- Görev / ödül sistemi (yeni kart açma, oyun içi token/para birimi)
- İlerlemiş upgrade ve kart nadir seviyeleri (rarity tiers)

---

## 5. Teknoloji Yığını (Tech Stack) Özeti

| Katman | Teknoloji | Notlar |
|---|---|---|
| İstemci (Client) | React Native + Expo | iOS + Android tek kod tabanından; Selman'ın React/TS deneyimiyle örtüşüyor |
| Animasyon | react-native-reanimated | Kart çevirme, saldırı efekti gibi akıcı animasyonlar |
| Görsel/kart çizimi | react-native-skia | Gelişmiş kart görselleri, GPU hızlandırmalı çizim (gerekirse) |
| State yönetimi | Zustand / Redux Toolkit | Kart koleksiyonu, oyun durumu yönetimi |
| Kimlik doğrulama | Firebase Auth | Misafir + gerçek kullanıcı desteği |
| Veritabanı | Firebase Firestore | Kart verisi, envanter, arkadaş listesi |
| Sunucu mantığı | Firebase Cloud Functions | Savaş doğrulama, hile önleme (Faz 2-3) |
| Gerçek zamanlı senkron | Firestore listeners / Realtime DB | Çevrimiçi savaş senkronizasyonu (Faz 3) |
| Geliştirme ortamı | Mac (Xcode + Android Studio + Node.js) | Hem iOS hem Android build alınabilir |

---

## 6. Açık Sorular / İleride Netleştirilecekler
- Kart nadir seviyeleri (rarity) ve olasılık sistemi nasıl olacak?
- Oyun içi ekonomi: ücretsiz mi, reklamlı mı, IAP (uygulama içi satın alma) olacak mı?
- Çocuklara yönelik uygulamalarda IAP/reklam kısıtlamaları (COPPA ve benzeri) — hangi yaş aralığı hedef alınacaksa ona göre mağaza kategorisi ve kısıtlamalar netleşecek.
- Kart görselleri: kendi çizilecek mi, hazır asset/illüstrasyon satın alınacak mı, yoksa AI görsel üretimi mi kullanılacak?

---

## 7. Sonraki Adım
Faz 1 kapsamındaki kart veri modeli ve ilk ekran akışı ile Flutter + Flame projesinin kurulumuna geçiş.
