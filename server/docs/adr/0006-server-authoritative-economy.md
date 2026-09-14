# 0006 — Sunucu otoriteli ekonomi ve işlem defteri

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
Oyun çevrimdışı oynanabiliyor (bota karşı maçlar) ve ilerleme cihazda
tutuluyordu. Soru şuydu: çevrimdışı mod hileyi kolaylaştırır mı?

Evet, kolaylaştırır — ama asıl mesele çevrimdışılık değil, **otoritenin
kimde olduğu**. Cihazdaki veri her zaman düzenlenebilir (jailbreak bile
gerekmez; Android yedeği yeter). Somut riskler: yerel bakiyeyi değiştirip
senkronlamak, "maçı kazandım"ı uydurmak, aynı ödül isteğini defalarca
göndermek, cihaz saatini ileri alıp günlük ödülü tekrarlamak.

## Karar
1. **İstemci tutar göndermez.** Yalnızca olay bildirir ("şu maç bitti,
   kazandım"). Ne kadar coin geleceğine sunucu karar verir (`reward.rules.ts`).
2. **Her para hareketi tek kapıdan geçer** (`EconomyService.move`).
3. **Bakiye + değişmez işlem defteri** birlikte tutulur, aynı transaction'da
   yazılır.
4. **Idempotency anahtarı** veritabanı seviyesinde benzersiz.
5. **Hız sınırı** (saatlik maç ödülü tavanı) Redis sayacıyla.

## Gerekçe
- **Neden sadece bakiye değil, defter de:** tek sayı denetlenemez. "1200 coin
  nereden geldi" sorusunun cevabı olmadan hile tespiti yapılamaz, yanlış giden
  bir işlem geri alınamaz, bakiye bozulduğunda yeniden hesaplanamaz.
- **Neden bakiye ayrı bir alan (saf event sourcing değil):** binlerce işlemli
  bir kullanıcıda her bakiye okuması toplama sorgusu olurdu. Bakiye önceden
  hesaplanmış hâlde duruyor, defter doğruluğun kaynağı olarak kalıyor; ikisi
  aynı transaction'da yazıldığı için ayrışamazlar (`audit()` bunu doğruluyor).
- **Neden `updateMany` + koşul, "oku-kontrol et-yaz" değil:** ikincisi klasik
  yarış durumu. İki istek aynı anda 100 okur, ikisi de yeterli bulur, ikisi de
  harcar → 100 coin'le 200 coin'lik alışveriş. Koşulu güncellemenin İÇİNE
  koymak, kontrolü veritabanının satır kilidine devrediyor. **20 paralel
  harcamayla test edildi: tam 3'ü geçti, bakiye 0'da durdu, eksiye düşmedi.**
- **Neden idempotency veritabanında (uygulamada değil):** "önce var mı diye
  bak, yoksa yaz" da bir yarış durumu. Benzersiz indeks, iki eşzamanlı isteğin
  ikincisini veritabanının kendisine reddettiriyor; kod bu hatayı yakalayıp
  kazananın sonucunu döndürüyor.

## Sonuçları
- Ağ koptuğunda istemci aynı isteği güvenle tekrarlayabilir.
- Çevrimdışı oynanan maçın ödülü, online olununca sunucudan alınır.
- **Kalan açık:** istemci hâlâ hiç oynamadığı bir maç için "kazandım"
  diyebilir. Hız sınırı bunun hasarını sınırlıyor ama çözmüyor. Kesin çözüm
  maçın sunucuda deterministik olarak yeniden oynatılması — `battleEngine.ts`
  saf ve UI'dan bağımsız yazıldığı için aynı motor sunucuda çalıştırılabilir.
  Faz 3'e planlandı.
- Gerçek para (mağaza satın alması) bu deftere `PURCHASE_STORE` olarak
  girecek; makbuz doğrulaması Apple/Google sunucularına karşı yapılacak,
  istemcinin "ödedim" demesi yeterli olmayacak.
