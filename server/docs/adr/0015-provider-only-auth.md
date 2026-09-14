# 0015 — Tek giriş yolu: Apple / Google

**Durum:** Kabul edildi · 2026-09-14
**İlgili:** [0005](0005-guest-account-upgrade.md) (misafir yükseltme), [0014](0014-account-recovery-and-deletion.md) (yerini bu aldı)

## Bağlam

[0014](0014-account-recovery-and-deletion.md) e-posta + şifre üzerine kurulu
bir kurtarma sistemi getirmişti: doğrulama, şifre sıfırlama, şifre
değiştirme, e-posta sağlayıcısı. Yazıldı, test edildi ve **aynı gün
kaldırıldı**.

Sebep basit bir soruydu: şifreyi biz mi saklamalıyız? Oyuncuların hepsinde
zaten bir Apple ya da Google hesabı var; o hesapları koruyan şirketler bunu
bizden iyi yapıyor ve oyuncu yeni bir şifre uydurmak zorunda kalmıyor.

## Karar — Giriş yalnızca Apple ya da Google ile

Kaldırılanlar: kayıt, e-posta/şifre girişi, e-posta doğrulama, şifre
sıfırlama, şifre değiştirme, `MailPort`, `auth_tokens` tablosu,
`passwordHash` ve `emailVerifiedAt` kolonları, `argon2` bağımlılığı.

**Kaldırılan kodun kendisi kazancın küçük kısmı.** Asıl kazanç birlikte giden
sorunlar:

| Kalkan şey | Neden sorundu |
|---|---|
| Şifre saklama | Sızıntıda en pahalı varlık; oyuncular şifre tekrar kullanıyor |
| Kaba kuvvet | Giriş ucu sonsuz deneme yüzeyi |
| Hesap sayımı | "Bu e-posta kayıtlı mı" sorusu tek başına satılabilir veri |
| Sıfırlama jetonu çalınması | E-posta kutusu ele geçen oyuncunun hesabı gider |
| E-posta sağlayıcısı | Hesap, fatura, teslim edilebilirlik, spam itibarı |
| Doğrulama akışı | Kaydın en çok terk edilen adımı |

Sağlayıcı e-postayı da doğrulanmış olarak veriyor, yani bizim ayrıca
doğrulamamız hem gereksiz hem imkânsız.

## Karar 2 — Misafir hesap KALIYOR ve varsayılan yol o

Oyuncu hiçbir şey yazmadan, hiçbir yere giriş yapmadan oynamaya başlıyor
([0005](0005-guest-account-upgrade.md)). Sağlayıcı girişi bir duvar değil bir
**kurtarma aracı**: "ilerlemeni bu cihaza bağlı bırakma" teklifi.

Bu ayrım önemli — giriş duvarı, oyuncuyu ilk dakikada kaybetmenin en hızlı
yollarından biri.

## Karar 3 — Tek uç, üç iş

`POST /auth/identity` kimlik doğrulaması İSTİYOR, çünkü çağıran zaten oturum
açmış durumda (uygulama açılışta misafir hesap alıyor). Böylece tek uç üçünü
birden yapıyor:

1. **Yükseltme** — kimlik kayıtlı değilse mevcut misafir hesaba bağlanır,
   ilerleme aynı satırda kalır.
2. **Dönüş** — kimlik bu kullanıcıya zaten bağlıysa sadece yeni jeton.
3. **Kurtarma** — kimlik başka bir hesaba bağlıysa o hesaba geçilir. Cihaz
   değiştiren oyuncunun ilerlemesini geri aldığı durum; sistemin varlık sebebi.

Üçüncü durumda buradaki misafir hesabın **ilerlemesi varsa 409 dönüyor**.
`force` gelmeden geçiş yok: iki hesabı birleştirmek karmaşık ve hataya açık,
ama oyuncunun saatlerini sessizce silmek kabul edilemez. Karar oyuncunun.

"İlerleme" ölçütü: oynanmış maç ya da sonradan edinilmiş kart. Başlangıç
kartları ve kayıt bonusu sayılmıyor — onlar her hesapta var.

## Karar 4 — Doğrulayıcı bir port'un arkasında

Gerçek doğrulama Apple/Google'ın JWKS anahtarlarını ve bizim istemci
kimliklerimizi gerektiriyor; ikisi de yok (geliştirici hesapları açılmadı).
`IdentityVerifier` portu sayesinde bağlama mantığı bugün yazılıp test
edilebiliyor.

Adapter seçimi **ortamı okuyan bir fabrikayla** yapılıyor, sabit bir
`useClass` ile değil: sahte doğrulayıcı jetonu hiç kontrol etmiyor, yani
üretimde aktif olması "herkes istediği hesaba girebilir" demek. Yanlışlıkla
sızması yapısal olarak imkânsız olmalı.

`aud` (audience) doğrulaması gerçek adapter'da atlanamaz: başka bir
uygulamaya verilmiş geçerli bir Google jetonu, kontrol edilmezse bizde de
geçerli sayılır ve o uygulamanın sahibi bütün oyuncularımızın hesabına
girebilir.

## Karar 5 — Hesap silme, sağlayıcıyla yeniden doğrulama istiyor

Silme zorunluluğu [0014](0014-account-recovery-and-deletion.md)'ten devam
ediyor (App Store 5.1.1(v)). Değişen: onay artık şifreyle değil, sağlayıcıdan
alınan **taze bir jetonla**. Access token 15 dakika yaşıyor ve silme geri
alınamaz — telefonu kısa süreliğine eline geçiren birinin hesabı silebilmesi
kabul edilemez. Apple ve Google da kendi silme akışlarında aynısını yapıyor.

## Bilinen bedeller

- **Apple/Google hesabını kaybeden oyuncuya verebileceğimiz kurtarma yok.**
  Kabul edildi: o hesapların kurtarma süreçleri bizimkinden iyi olurdu.
- **Google Play Services olmayan Android** cihazlarda Google girişi
  çalışmıyor (Huawei'nin bir kısmı). O oyuncular misafir olarak oynamaya
  devam ediyor ama ilerlemelerini bağlayamıyor.
- **Platform değiştirme sürtünmesi**: iOS'ta Apple ile giren oyuncu Android'e
  geçerse Apple girişi web akışıyla mümkün ama zahmetli.

## Açık kalanlar

- Apple / Google istemci kimlikleri ve gerçek JWKS doğrulaması (iskelet hazır).
- Kullanıcı adı: PvP/lig dilimine ertelendi. Serbest metin, projenin sabit
  çocuk güvenliği kısıtına (hiçbir yerde serbest metin yok) takılıyor;
  üretilen ad + kelime listesinden özelleştirme muhtemel çözüm.
- Oturum listesi ve tek tek iptal.
