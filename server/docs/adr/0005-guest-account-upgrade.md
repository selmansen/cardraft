# 0005 — Misafir hesabın aynı satırda yükseltilmesi

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
Oyuncu hesap açmadan oynayabilmeli (sürtünmeyi azaltmak için), ama sonradan
e-posta/şifre bağladığında **hiçbir ilerlemesini kaybetmemeli** — koleksiyon,
coin, maç istatistikleri.

## Seçenekler
1. **Ayrı `GuestUser` ve `User` tabloları.** Kavramsal olarak temiz görünüyor.
   Ama yükseltme, ilerlemeye ait her satırı bir tablodan diğerine taşımak
   demek: her yeni özellik (envanter, lig puanı, arkadaşlık) bu taşıma
   koduna bir madde daha ekler ve unutulan bir madde sessiz veri kaybıdır.
2. **Tek `User` tablosu, `isGuest` bayrağı.** Misafir de normal bir kullanıcı;
   yükseltme sadece `email`/`passwordHash` doldurup bayrağı düşürmek.

## Karar
2. seçenek. `email` ve `passwordHash` nullable, `isGuest` varsayılan `true`.
Yükseltme tek bir `UPDATE`.

## Gerekçe
- Veri taşıma diye bir adım yok, dolayısıyla veri kaybı riski de yok. İlerleme
  zaten aynı `userId`'ye bağlı kalıyor.
- Yeni özellikler eklendikçe yükseltme kodunun bakım yükü artmıyor.
- Misafir kullanıcı, kimliği doğrulanmış bir kullanıcının tüm haklarına sahip;
  fark sadece "geri dönüşü var mı" sorusunda.

## Sonuçları
- `email` nullable olduğu için "e-posta zorunlu" varsayımı hiçbir yerde
  yapılamaz — sorgularda bilinçli kontrol gerekiyor.
- Aynı kurulumdan (`installationId`) tekrar misafir girişi AYNI hesabı
  döndürüyor; oyuncu uygulamayı kapatıp açtığında ilerlemesi duruyor.
- Güvenlik kuralı: cihaz zaten gerçek bir hesaba bağlıysa misafir girişi
  REDDEDİLİYOR. Aksi hâlde cihazı eline geçiren biri, şifre bilmeden misafir
  kapısından gerçek hesaba girebilirdi.
