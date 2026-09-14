# Mimari Karar Kayıtları (ADR)

Bu klasördeki her dosya, projede verilmiş **bir** mimari kararı ve o kararın
**neden** verildiğini anlatır.

Neden böyle bir şey tutuyoruz: kod "ne yapıldığını" gösterir, "neden
yapıldığını" göstermez. Altı ay sonra (ya da bir mülakatta) "burada neden
adapter kullandın, neden argon2, neden refresh token'ı veritabanında
tutuyorsun" sorusunun cevabı koda bakarak bulunamaz — sadece o anda kafada
olan gerekçe kaybolur. ADR o gerekçeyi kayıt altına alır.

Format bilinçli olarak kısa: bağlam, seçenekler, karar, sonuçları. Uzun
dokümanlar yazılmaz ve okunmaz; bu dosyalar bir sayfayı geçmemeli.

| No | Karar |
|---|---|
| [0001](0001-nestjs-modular-architecture.md) | Modüler NestJS mimarisi ve katman ayrımı |
| [0002](0002-prisma-domain-split-schema.md) | Prisma şemasının domain bazlı dosyalara bölünmesi |
| [0003](0003-queue-adapter-pattern.md) | Kuyruğun adapter arkasına alınması |
| [0004](0004-jwt-access-opaque-refresh.md) | Access JWT, refresh opaque + veritabanında hash'li |
| [0005](0005-guest-account-upgrade.md) | Misafir hesabın aynı satırda yükseltilmesi |
| [0006](0006-server-authoritative-economy.md) | Sunucu otoriteli ekonomi ve işlem defteri |
| [0007](0007-server-side-match-verification.md) | Maçın sunucuda doğrulanması (deterministik yeniden oynatma) |
| [0008](0008-currency-model-and-server-stats.md) | Para birimi modeli (jant/coin) ve istatistiklerin sunucuya taşınması |
| [0009](0009-card-pricing-and-progression.md) | Kart fiyatlandırması, güç seviyeleri ve ilerleme temposu |
| [0010](0010-pvp-timing-packs-and-monetisation.md) | PvP tur süresi, paket modeli ve monetizasyonun şekli |
| [0011](0011-inventory-and-client-integration.md) | Envanterin sunucuya taşınması ve istemci–API entegrasyonu |
| [0012](0012-bot-scaling-and-loadout-rules.md) | Bot ölçeklemesinin ölçülmesi ve kadro kurallarının sunucuda dayatılması |
| [0013](0013-store-pack-opening.md) | Paket açma: çekiliş sunucuda, tekrar koruması istemcinin kimliğiyle |
| [0014](0014-account-recovery-and-deletion.md) | ~~Hesap kurtarma: e-posta doğrulama, şifre sıfırlama~~ → 0015 |
| [0015](0015-provider-only-auth.md) | Tek giriş yolu: Apple / Google; hesap silme sağlayıcıyla doğrulanıyor |
| [0016](0016-guest-is-a-demo.md) | Misafirlik bir deneme: cüzdan 0, ilerleme yok, hediye girişte |
