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

### Eklendi

- Dal, sürüm ve yayın akışı: `develop`/`main` ayrımı, GitHub Actions CI,
  etiketle tetiklenen yayın. Bkz. `docs/gelistirme-akisi.md`.

### Düzeltildi

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
