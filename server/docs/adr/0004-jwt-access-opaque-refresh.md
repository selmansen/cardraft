# 0004 — Access token JWT, refresh token opaque + veritabanında hash'li

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
Mobil istemci uzun süreli oturum bekliyor (kullanıcı her açılışta giriş
yapmamalı), ama çalınan bir oturumu iptal edebilmek de gerekiyor.

## Seçenekler
1. **Her ikisi de JWT.** En yaygın örneklerdeki kurulum. Sorun: JWT tasarımı
   gereği iptal edilemez. Çalınan bir refresh JWT'si 30 gün boyunca sınırsız
   access token üretir ve durdurmanın yolu yoktur (kara liste tutmak, JWT'nin
   durumsuzluk avantajını zaten ortadan kaldırır).
2. **Her ikisi de veritabanı oturumu.** Tam kontrol, ama her istekte bir sorgu.
3. **Access JWT (kısa), refresh opaque + DB'de hash'li (uzun).**

## Karar
3. seçenek.
- Access: JWT, 15 dakika, imzayla doğrulanır, veritabanına gidilmez.
- Refresh: 256 bit rastgele dize; veritabanında **sadece SHA-256 hash'i**
  saklanır; her kullanımda döndürülür (rotasyon) ve eskisi iptal edilir.

## Gerekçe
- Sık yapılan iş (her isteğin doğrulanması) ucuz kalıyor: sorgu yok.
- Nadir yapılan iş (yenileme) pahalı olabilir: orada bir sorguya katlanıp
  iptal yeteneği kazanıyoruz.
- Hash saklamak: veritabanı sızarsa token'ların kendisi orada değil. Şifreleri
  hash'leyip oturum jetonlarını düz metin tutmak tutarsız olurdu.
- SHA-256 yeterli, argon2 gereksiz: argon2'nin yavaşlığı düşük entropili
  şifreler içindir. 256 bit rastgele değere kaba kuvvet uygulanamaz; her
  yenilemede argon2 çalıştırmak sadece uç noktayı yavaşlatırdı.

## Sonuçları
- Çalınan refresh en fazla bir kez işe yarar (rotasyon).
- "Tüm cihazlardan çıkış" tek bir UPDATE.
- Eksi: yenileme uç noktası veritabanına bağımlı. Kabul edilebilir, çünkü
  15 dakikada bir çağrılıyor.
- Açık uç: iptal edilmiş bir token'ın tekrar kullanılması şu an sadece
  reddediliyor. İdeali, bunu "hesap ele geçirilmiş olabilir" sinyali sayıp o
  kullanıcının tüm oturumlarını düşürmek — kanca `TokenService.rotate` içinde
  hazır, ekonomi dilimiyle birlikte eklenecek.
