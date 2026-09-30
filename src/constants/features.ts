/**
 * Yayın kapıları — "kod projede kalsın, ekranda görünmesin".
 *
 * Bir özelliği hazır olmadığı için SİLMEK, yazılmış tasarımı ve mantığı da
 * silmek demek; sonra yeniden yazılıyor. Ölü kod olarak bırakmak da iyi değil:
 * bağlı olduğu ekranlar zamanla ondan haberi olmadan değişiyor. Bu dosya
 * üçüncü yolu veriyor — kod derlenmeye ve tip kontrolünden geçmeye devam
 * ediyor, yalnızca kullanıcıya gösterilmiyor.
 *
 * Neden `false` olanlar kapalı:
 *
 * `league` / `friends` — ikisi de Faz 3'te. Kapalı olmalarının bir sebebi de
 * mağaza incelemesi: olmayan bir özelliği "yakında" diye tanıtan ekranlar
 * reddedilebiliyor. İlk sürüm bota karşı tek oyunculu çıkıyor.
 *
 * `coinPurchase` — coin gerçek parayla alınıyor (bkz. types/index.ts
 * CardPrice) ama uygulama içi satın alma henüz kurulmadı. Kapalıyken coin
 * bir ÖDEME SEÇENEĞİ olarak sunulmuyor ve "coin al" düğmesi hiç
 * gösterilmiyor. Elinde coin OLAN oyuncu yine harcayabiliyor: satın alma
 * açıldığında ya da geliştirme aracıyla coin yazıldığında akışın tamamı
 * çalışıyor, yani kapı sadece vitrini kapatıyor, tesisatı değil.
 */
export const FEATURES = {
  league: false,
  friends: false,
  coinPurchase: false,
} as const;
