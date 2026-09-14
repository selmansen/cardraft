# 0014 — Hesap kurtarma: doğrulama, sıfırlama ve silme

**Durum:** ⚠️ **Yerini [0015](0015-provider-only-auth.md) aldı** (2026-09-14, aynı gün)

> Bu ADR e-posta + şifre girişini varsayıyordu. Aynı gün giriş yolu yalnızca
> Apple/Google'a indirildi: şifre olmayınca bu belgedeki doğrulama, sıfırlama
> ve şifre değiştirme kararlarının konusu da ortadan kalktı. Kayıt olarak
> duruyor çünkü **hesap silme** kararı (Karar 6) ve **hesap sayımı** gerekçesi
> hâlâ geçerli ve 0015 onlara dayanıyor.

**Kabul edilmişti:** 2026-09-14
**İlgili:** [0004](0004-jwt-access-opaque-refresh.md) (oturumlar), [0005](0005-guest-account-upgrade.md) (misafir yükseltme), [0011](0011-inventory-and-client-integration.md) (envanter)

## Bağlam

Misafir hesap ([0005](0005-guest-account-upgrade.md)) oyuncuyu hiçbir şey
yazmadan oyuna sokuyor ve ilerleme sunucuda birikiyor: koleksiyon, jant,
istatistikler. Ama o hesabın tek anahtarı cihazdaki `installationId`.
Uygulama silinirse, telefon değişirse ya da depolama temizlenirse **hesap
erişilemez hâle geliyor** — ve artık orada gerçek bir değer var.

Yani kimlik akışları bir "özellik" değil, ekonominin gereği: oyuncudan 40
saat isteyen bir oyunun o 40 saati kurtarabilir olması lazım.

## Karar 1 — Doğrulama oyuna girişi ENGELLEMİYOR

Kayıt olan oyuncu doğrulamayı beklemeden oynuyor, satın alıyor, maça
giriyor. Doğrulamanın tek işlevi şifre sıfırlamayı mümkün kılmak.

Doğrulama duvarı, oyuncuyu ilk dakikada kaybetmenin en hızlı yollarından
biri — üstelik burada koruduğu bir şey de yok: doğrulanmamış bir hesabın
kimseye zararı dokunmuyor.

## Karar 2 — Doğrulanmamış adrese sıfırlama bağlantısı GÖNDERİLMİYOR

Bu, doğrulamanın asıl sebebi. Adresini yanlış yazan (`selman@gmial.com`) ya
da bilerek başkasınınkini yazan biri, o adrese gelen sıfırlama bağlantısıyla
hesabı ele geçirebilirdi. Doğrulanmamış adres, hesabın sahibi hakkında
hiçbir şey kanıtlamıyor.

## Karar 3 — "Şifremi unuttum" her zaman 204 döner

Hesabın var olup olmadığı söylenmiyor. Aksi halde saldırgan adresleri tek
tek deneyerek hangilerinin kayıtlı olduğunu öğrenirdi (hesap sayımı) — ve bu
liste tek başına satılabilir bir veridir.

Aynı sebeple jeton hataları da tek mesaj: geçersiz, süresi dolmuş ve
kullanılmış jetonlar ayırt edilmiyor.

## Karar 4 — Şifre değişince BÜTÜN oturumlar kapanıyor

Sıfırlamanın en yaygın sebebi "hesabıma başkası giriyor olabilir". Açık
oturumlar bırakılırsa o kişi içeride kalmaya devam eder ve sıfırlama hiçbir
işe yaramaz. Şifre değiştirmede de aynı kural geçerli.

## Karar 5 — Jetonlar hash'li, tek kullanımlık, süreli

Refresh token'larla ([0004](0004-jwt-access-opaque-refresh.md)) aynı
gerekçe: veritabanı sızarsa düz metin jeton doğrudan hesap devralmaya yarar.

Ömürler farklı ve bilerek: **doğrulama 24 saat**, **sıfırlama 1 saat**.
Doğrulama acele gerektirmiyor (oyunu engellemiyor); sıfırlama bağlantısı ise
hesabın kendisi, e-posta kutusu bir süreliğine başkasının eline geçse bile
pencere dar olmalı.

Yeni jeton üretmek öncekileri geçersiz kılıyor: "tekrar gönder"e üç kez basan
oyuncunun üç geçerli bağlantısı dolaşmamalı.

## Karar 6 — Hesap silme zorunlu ve gerçek

Apple App Store, hesap açmaya izin veren uygulamanın hesabı **uygulama
içinden** silmeye de izin vermesini şart koşuyor (5.1.1(v)); Play'in de
benzer bir gereği var. Yani bu bir incelik değil, yayın engeli.

Silme gerçek: cüzdan, defter, koleksiyon, maçlar, cihazlar `onDelete:
Cascade` ile gidiyor. Yumuşak silme (satırı işaretleyip bırakmak) tercih
edilmedi — "sil" diyen oyuncuya verilen söz bu.

**Gerçek parayla satın alma eklendiğinde bu karar yeniden açılmalı:** o zaman
iade ve muhasebe için satın alma kayıtlarının kimliksizleştirilmiş hâlde
saklanması gerekecek.

## Karar 7 — E-posta bir port'un arkasında

`MailPort` + `LogMailAdapter`. Kuyruk ve bildirimde olduğu gibi: hangi
sağlayıcıyı kullanacağımız (Resend, SES, Postmark) bir hesap açmayı
gerektiriyor ve o karar akışları yazmayı bekletmemeli. Bugün e-posta loga
düşüyor, akışın tamamı uçtan uca test edilebiliyor. Sağlayıcı geldiğinde
değişen tek şey `mail.module.ts`'teki `useClass` satırı.

## Karar 8 — `user_identities` tablosu şimdiden

Apple ve Google ile giriş henüz YOK ama tablo var. Sebebi: bir kullanıcının
birden fazla giriş yolu olması ilişkisel olarak "bir kullanıcı, çok kimlik"
demek. Sonradan eklemek, `User` tablosuna sağlayıcı kolonları serpiştirip
sonra ayıklamak olurdu.

iOS'ta üçüncü taraf girişi sunan uygulamanın **Apple ile Giriş'i de** sunması
App Store kuralı: Google eklenirse Apple da eklenecek.

## Doğrulama

11 e2e testi (gerçek Postgres): doğrulanmamış hesap oynayabiliyor ·
doğrulanmamış adrese sıfırlama gitmiyor · jeton tek kullanımlık · olmayan
adres için de 204 · sıfırlama açık oturumları kapatıyor · eski şifre
çalışmıyor · hesap silinince cüzdan ve koleksiyon da gidiyor.

## Açık kalanlar

- **E-posta sağlayıcısı seçilmedi** — bugün hiçbir e-posta gerçekten
  gönderilmiyor. Üretime çıkmadan önce şart.
- Apple / Google ile giriş (şema hazır, uygulama yok).
- Oturum listesi ve tek tek iptal ("bu cihazdan çıkış yap").
- Kadro hâlâ cihazda: hesabını kurtaran oyuncu koleksiyonunu geri alıyor ama
  kadrosunu yeniden kuruyor.
