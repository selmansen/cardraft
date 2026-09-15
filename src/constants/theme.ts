/**
 * CarDraft design system v2 — warm light theme.
 * Values transcribed from docs/design/project/Cardraft Faz1 Prototip.dc.html
 * and "Cardraft - Tasarım Sistemi v2 (Açık Tema).md".
 */

export const colors = {
  bg: '#FBF7F0', // warm cream — screen background
  bgSheet: '#EDE7DA', // battle hand sheet / device body
  surface: '#FFFFFF',
  sunken: '#F3EEE4', // stat boxes, bar channels
  border: '#EBE3D6',
  borderStrong: '#C9CDD8',

  primary: '#3A7BF0',
  primaryDark: '#1E4FB0', // chunky-button base
  primarySoft: '#DCE9FF',
  primaryInk: '#2E62C8',

  accent: '#FF9522',
  accentDark: '#B35C00',
  accentSoft: '#FFF0DC',
  accentInk: '#B35C00',

  grape: '#A15CF5',
  grapeInk: '#7B32D6',
  grapeSoft: '#F3E9FF',
  bubble: '#FF6FA5',

  success: '#2FBF6B',
  successInk: '#137A40',
  danger: '#F04A47',
  dangerInk: '#C22C29',
  warning: '#FFC53D',

  ink: '#1E2436', // primary text
  inkSoft: '#4A5266',
  textMuted: '#6B7285',
  textFaint: '#A0A6B5',
} as const;

export type RarityKey = 'common' | 'rare' | 'epic' | 'legendary';

export const rarity: Record<
  RarityKey,
  { border: string; art: string; pill: string; ink: string; label: string; stars: number }
> = {
  // Was #E3E6EC — nearly invisible on a white card (#FFFFFF): rare/epic/
  // legendary all get a strongly-tinted border, common was the one rarity
  // with a washed-out outline, and it's also the one every starter card is.
  common: { border: '#AFB5C2', art: '#EFF1F5', pill: '#EFF1F5', ink: '#4A5266', label: 'Sıradan', stars: 0 },
  rare: { border: '#3A7BF0', art: '#DCE9FF', pill: '#DCE9FF', ink: '#2E62C8', label: 'Nadir', stars: 1 },
  epic: { border: '#A15CF5', art: '#F3E9FF', pill: '#F3E9FF', ink: '#7B32D6', label: 'Efsanevi', stars: 2 },
  legendary: { border: '#FF9522', art: '#FFF0DC', pill: '#FFF0DC', ink: '#B35C00', label: 'Destansı', stars: 3 },
};

/** Font family names registered in app/_layout.tsx via expo-font. */
export const font = {
  display: 'Baloo2-ExtraBold',
  heading: 'Baloo2-ExtraBold',
  headingSm: 'Baloo2-Bold',
  stat: 'Baloo2-ExtraBold',
  body: 'Nunito-SemiBold',
  bodyBold: 'Nunito-Bold',
  bodyBlack: 'Nunito-Black',
} as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 } as const;

/**
 * Gövde tipografisi — üç basamak, en küçüğü 14.
 *
 * Eskiden beş basamak vardı (micro 11 · caption 12 · small 13 · body 14 ·
 * bodyLg 15) ve ilk üçü telefonda okunmuyordu: rozet rakamları, nadirlik
 * etiketleri ve ipucu metinleri gözü yoruyordu. Ayrıca 11-12-13 arasındaki
 * fark bir hiyerarşi kurmuyordu, sadece tutarsızlık üretiyordu.
 *
 * Şimdi üç basamak var ve aralarındaki fark görünür:
 *   bodySmall 14 — ikincil bilgi, rozet, etiket (ALT SINIR)
 *   body      16 — varsayılan metin, buton, liste satırı
 *   bodyBig   18 — öne çıkan satır, modal başlığı altı
 *
 * Başlıklar (Baloo 2) bu ölçeğin dışında; onlar yerinde yazılıyor.
 */
export const text = {
  bodySmall: { fontSize: 14, lineHeight: 19 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyBig: { fontSize: 18, lineHeight: 24 },
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
/** @deprecated use `space` */
export const spacing = space;

export const shadow = {
  card: {
    shadowColor: '#1E2436',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#1E2436',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

/** Space the docked bottom nav reserves at the bottom of scroll content. */
export const NAV_CLEARANCE = 122;

/**
 * Savaş ekranında basılı tutma süresi.
 *
 * Burada uzun basma SÜRÜKLEMEYLE yarışıyor: oyuncu kartı sahaya sürüklerken
 * parmağını bir an sabit tutuyor ve süre kısa olursa sürükleme yerine
 * inceleme açılıyor. 450 ms o çakışmayı önlerken hâlâ "basılı tuttum" hissini
 * veriyor (800'dü, alışkanlık hâline gelince yavaş geliyordu).
 */
export const LONG_PRESS_MS = 450;

/**
 * Koleksiyon ızgarasında basılı tutma süresi — belirgin şekilde daha kısa.
 *
 * Orada yarışan bir sürükleme jesti YOK: kart ya dokunmayla kadroya giriyor
 * ya da basılı tutmayla detayı açılıyor. Uzun bir eşik, oyuncuya "acaba
 * çalışmıyor mu" dedirtiyordu ve ekranın altına "karta basılı tut" diye bir
 * ipucu yazmayı gerektiriyordu. Jest kendini anlatacak kadar hızlı olunca o
 * ipucuna da gerek kalmıyor.
 */
export const CARD_INSPECT_MS = 180;
