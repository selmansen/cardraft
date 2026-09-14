# 0003 — Kuyruğun adapter arkasına alınması

**Durum:** Kabul edildi · 2026-09-13

## Bağlam
Arka plan işleri gerekiyor (bildirim gönderimi, ödül hesaplama, ileride mağaza
makbuzu doğrulama). Bugün BullMQ yeterli, ama ileride RabbitMQ ya da Kafka'ya
geçilmesi gündemde.

## Seçenekler
1. **Servislere doğrudan BullMQ enjekte etmek.** En az kod. Ama taşıyıcıyı
   değiştirmek, iş mantığı hiç değişmediği hâlde onlarca dosyayı değiştirmek
   demek olurdu.
2. **Port + adapter.** İş mantığı `QueuePort` arayüzünü görür, `BullMqQueueAdapter`
   onu uygular. Bir arayüz + bir sınıf fazladan dosya.

## Karar
2. seçenek. `src/infrastructure/queue/queue.port.ts` arayüzü tanımlar,
`QUEUE_PORT` sembolü DI token'ıdır, `queue.module.ts` hangi adapter'ın
kullanılacağına karar veren TEK yerdir.

## Gerekçe
- **DIP:** Üst seviye (iş mantığı) alt seviyeye (BullMQ) değil, ikisi de
  soyutlamaya bağlı.
- **OCP:** Yeni taşıyıcı = yeni adapter sınıfı; mevcut iş kodu değişmez.
- **ISP:** Arayüz üç metotla sınırlı. BullMQ'nun geri kalan API'si iş
  mantığına sızmıyor.
- Testlerde bellek içi bir sahte adapter vermek mümkün — kuyruk testi için
  Redis ayağa kaldırmak zorunlu olmaktan çıkıyor.

## Sonuçları
- Artı: taşıyıcı değişimi tek satır; iş mantığı test edilebilir.
- Eksi: BullMQ'ya özgü gelişmiş özellikler (öncelik kuyruğu, akış kontrolü)
  kullanılacaksa arayüzün genişlemesi gerekir. Bilinçli kabul: arayüz
  ihtiyaç doğdukça büyüyecek, baştan tahminle değil.
- **Bu bir "ileride lazım olur" soyutlaması DEĞİL** — taşıyıcının değişeceği
  baştan biliniyor. Bilinmeseydi erken soyutlama olurdu ve yazılmazdı.
