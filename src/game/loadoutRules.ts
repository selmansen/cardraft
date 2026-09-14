/**
 * Kadro kuralları — oyuncu ve bot için TEK kaynak.
 *
 * Bu sayılar daha önce `gameStore` içindeydi, yani yalnızca istemcide.
 * Sunucu ve bot desteleri onları görmediği için iki sorun doğmuştu:
 *
 * 1. Bot 6 araç + 3 pit = 9 kart taşıyordu, oyuncu ise 8. Deste, kadronun iki
 *    katı olduğu için bu bota 18'e 16 kart demek — ve deste bitince yorgunluk
 *    hasarı başladığı için doğrudan bir avantaj. Ölçüldü: maçların %20-60'ı
 *    yorgunluğa kadar gidiyor, yani bu fark kâğıt üstünde değil.
 * 2. Sunucu kadronun BOYUTUNU hiç doğrulamıyordu (yalnızca her dizinin en
 *    fazla 8 olmasını). Değiştirilmiş bir istemci 8 araç + 8 pit gönderip
 *    32 kartlık desteyle oynayabilirdi.
 *
 * Kurallar burada durduğu ve `sync-engine` ile sunucuya kopyalandığı için
 * ikisi de aynı cümleyi okuyor.
 */

/** Kadro toplamı: araçlar + Pit Ekibi kartları tek bir bütçeyi paylaşır. */
export const LOADOUT_TOTAL = 8;

/** En az bu kadar araç — yoksa deste hiç saldıramaz. */
export const MIN_VEHICLES = 3;

/** En fazla bu kadar destek — yoksa deste tamamen yardımcı kartlardan oluşur. */
export const MAX_SUPPORT = 5;

/**
 * Botun kadrosu da aynı bütçeden: 5 araç + 3 pit.
 *
 * Oyuncunun varsayılan kadrosuyla birebir aynı dağılım. Bot daha fazla kart
 * taşırsa uzun maçlarda kimsenin vermediği bir karar yüzünden kazanır.
 */
export const BOT_VEHICLE_COUNT = LOADOUT_TOTAL - 3;
export const BOT_SUPPORT_COUNT = LOADOUT_TOTAL - BOT_VEHICLE_COUNT;

/**
 * Kadro geçerli mi? Geçerliyse `null`, değilse kullanıcıya gösterilebilecek
 * bir mesaj döner.
 *
 * Mesaj döndürmesi bilinçli: sunucu bunu 400'ün gövdesine koyuyor, istemci de
 * aynı metni gösterebiliyor. İki yerde iki ayrı metin yazılsaydı, oyuncuya
 * arayüzde söylenenle sunucunun reddetme sebebi farklı olabilirdi.
 */
export function validateLoadout(vehicleIds: string[], supportIds: string[]): string | null {
  const total = vehicleIds.length + supportIds.length;

  if (total !== LOADOUT_TOTAL) {
    return `Kadro tam ${LOADOUT_TOTAL} kart olmalı (şu an ${total}).`;
  }
  if (vehicleIds.length < MIN_VEHICLES) {
    return `Kadroda en az ${MIN_VEHICLES} araç olmalı (şu an ${vehicleIds.length}).`;
  }
  if (supportIds.length > MAX_SUPPORT) {
    return `Kadroda en fazla ${MAX_SUPPORT} Pit Ekibi kartı olabilir (şu an ${supportIds.length}).`;
  }
  // Aynı kartı iki kez saymak, desteye dört kopya koymak demek olurdu.
  const duplicates = [...vehicleIds, ...supportIds].filter(
    (id, i, all) => all.indexOf(id) !== i,
  );
  if (duplicates.length > 0) {
    return `Aynı kart kadroda birden fazla kez olamaz: ${[...new Set(duplicates)].join(', ')}.`;
  }
  return null;
}
