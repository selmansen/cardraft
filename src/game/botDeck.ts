import { CARDS } from '@/data/cards';
import { SUPPORT_CARDS } from '@/data/supportCards';
import type { LoadoutEntry } from './battleEngine';
import { BOT_SUPPORT_COUNT, BOT_VEHICLE_COUNT } from './loadoutRules';

/**
 * A few hand-tuned bot decks with a sensible fuel curve. One is chosen at
 * random per battle. `level` scales lightly with how many battles the player
 * has won, so the bot keeps pace. The bot ignores the player's unlock state,
 * so locked cards may appear here.
 */
const BOT_DECKS: string[][] = [
  // Hız / aggro
  ['sandstorm-buggy', 'falconi-turbo', 'vipera-gt', 'nocturne-coupe', 'nitro-nomad', 'silverstreak-s9'],
  // Canavar kamyon / kontrol
  ['mudslinger-max', 'boulder-baron', 'quake-hauler', 'crane-titan', 'tombstone-crusher', 'titan-stomp'],
  // Klasik / konvoy sinerjisi
  ['chrome-cruiser', 'bonnet-58', 'velvet-roadster', 'convoy-captain', 'grand-marquis', 'apex-meridian'],
  // Hizmet / grind
  ['rescue-rig', 'cobalt-cargo', 'blaze-response', 'convoy-captain', 'wrecking-warden', 'iron-mammoth'],
  // Arazi / tempo
  ['sandstorm-buggy', 'trailblazer-4x4', 'nitro-nomad', 'dust-devil', 'nocturne-coupe', 'summit-king'],
  // Gelecek / elektrikli
  ['volt-scout', 'ion-coupe', 'zephyr-volt', 'pulse-gt', 'blaze-response', 'singularity'],
];

const KNOWN_IDS = new Set(CARDS.map((c) => c.id));

/** Listeyi rastgele elemanlar atarak `size` uzunluğuna indirir. */
function dropToSize(ids: string[], size: number): string[] {
  const rest = [...ids];
  while (rest.length > size) {
    rest.splice(Math.floor(Math.random() * rest.length), 1);
  }
  return rest;
}

/**
 * Botun destesi, oyuncunun ilerlemesine göre NADİRLİK olarak ölçekleniyor.
 *
 * Seviye sistemi kaldırılınca eski kaldıraç (kartların seviyesini yükseltmek)
 * gitti. Yerine gelen bu: yeni oyuncu sıradan/nadir ağırlıklı bir desteyle
 * karşılaşıyor, ilerledikçe botun destesine efsanevi ve destansı kartlar
 * giriyor. Oyuncunun kendi koleksiyonu da aynı yönde büyüdüğü için ikisi
 * paralel gidiyor.
 *
 * Zorluk SEÇİMİ (kolay/normal/zor) bundan bağımsız duruyor: o garaj canını,
 * açılış elini ve botun hata oranını belirliyor. Yani iki eksen var — biri
 * oyuncunun tercihi, diğeri ilerlemesi.
 */
const RARITY_ORDER: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/**
 * Kaç maç kazandıysa o kadar üst kademeye izin var (0 = sadece en alt kademe).
 * Eşikler kart fiyatlarıyla aynı tempoda: ilk destansı kart ~28 maç ediyor,
 * bot da yaklaşık o civarda destansı görmeye başlıyor. Hem araç nadirliği hem
 * Pit Ekibi güç seviyesi bu tek merdiveni kullanıyor — ikisinin ayrı ayrı
 * ayarlanması, birini değiştirip diğerini unutmak demek olurdu.
 */
function progressTier(battlesWon: number): number {
  return battlesWon >= 25 ? 3 : battlesWon >= 10 ? 2 : battlesWon >= 3 ? 1 : 0;
}

export function makeBotLoadout(battlesWon = 0): LoadoutEntry[] {
  const deck = BOT_DECKS[Math.floor(Math.random() * BOT_DECKS.length)].filter(
    (id) => KNOWN_IDS.has(id),
  );

  const cap = progressTier(battlesWon);

  const byId = new Map(CARDS.map((c) => [c.id, c]));
  const allowed = deck.filter((id) => (RARITY_ORDER[byId.get(id)?.rarity ?? 'common'] ?? 0) <= cap);

  /**
   * Kadro TAM `BOT_VEHICLE_COUNT` araç olmalı — ne eksik ne fazla.
   *
   * Deste boyutu kadronun iki katı ve deste bitince yorgunluk hasarı
   * başlıyor; ölçümde maçların %20-60'ı oraya kadar gidiyordu. Yani bir kart
   * fazlası, kimsenin vermediği bir karar yüzünden kazanılan maç demek.
   * Önceden bot 6 araç taşıyordu (oyuncu 5), üstüne nadirlik filtresi
   * desteyi bazen 4'e düşürüyordu — sayı hem fazla hem öngörülemezdi.
   *
   * Fazlalık RASTGELE atılıyor, baştan ya da sondan değil: destelerin en
   * nadir kartı listelerin sonunda duruyor, dolayısıyla "ilk N'i al" demek
   * her destenin efsanevi kartını atmak — yani nadirlik merdiveninin en üst
   * basamağını sessizce silmek olurdu.
   */
  const picked = dropToSize(allowed, BOT_VEHICLE_COUNT);

  if (picked.length < BOT_VEHICLE_COUNT) {
    // Nadirlik tavanı desteyi kısalttıysa aynı tavandan en ucuz kartlarla
    // tamamla: bot her zaman dolu bir kadroyla oynamalı.
    const filler = [...CARDS]
      .filter((c) => (RARITY_ORDER[c.rarity] ?? 0) <= cap && !picked.includes(c.id))
      .sort((a, b) => a.cost - b.cost)
      .slice(0, BOT_VEHICLE_COUNT - picked.length)
      .map((c) => c.id);
    picked.push(...filler);
  }

  return picked.map((cardId) => ({ cardId }));
}

/**
 * Botun Pit Ekibi kartları — oyuncunun varsayılan kadrosuyla aynı sayıda
 * (`BOT_SUPPORT_COUNT`), aynı havuzdan.
 *
 * The bot went without any of these until now, which quietly made Pit Ekibi a
 * player-only mechanic: you could shield, heal and ambush, it couldn't, and
 * the whole card type went untested against you.
 *
 * Havuz araçlarla aynı merdivenden geçiyor: yeni oyuncunun elinde sadece güç-1
 * destek kartları varken botun Turbo Şarj çekmesi, oyuncunun karşılığını
 * veremeyeceği bir üstünlük olurdu.
 */
export function makeBotSupportLoadout(count = BOT_SUPPORT_COUNT, battlesWon = 0): string[] {
  const maxPower = progressTier(battlesWon) + 1;
  const pool = SUPPORT_CARDS.filter((c) => c.power <= maxPower).map((c) => c.id);
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}
