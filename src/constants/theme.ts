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
 * Non-headline type scale — every step was bumped up one notch for readability
 * (headline/display sizes in Baloo 2 were fine and are untouched). Pair each
 * with a lineHeight ~1.3x so custom fonts (Baloo 2 / Nunito) sit centered
 * inside pills and buttons instead of looking vertically off.
 */
export const text = {
  micro: { fontSize: 11, lineHeight: 14 }, // badge numbers, tiny stat labels
  caption: { fontSize: 12, lineHeight: 16 }, // uppercase labels, chip text
  small: { fontSize: 13, lineHeight: 18 }, // secondary/help text
  body: { fontSize: 14, lineHeight: 19 }, // default body, button labels
  bodyLg: { fontSize: 15, lineHeight: 20 },
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
export const NAV_CLEARANCE = 112;

/** How long a press-and-hold takes to open a card's info panel — the same
 *  duration everywhere it's used (battle hand/board cards, Squad's vehicle
 *  grid) so it reads as one consistent app-wide gesture, not a per-screen
 *  quirk. Was 800ms, felt slow once it became a habit players reach for. */
export const LONG_PRESS_MS = 450;
