/**
 * Short reminders shown under each stat in a card's inspect panel. The full
 * explanation lives on the How to Play screen (STAT_LEGEND there) — this is
 * just enough to jog memory without leaving the panel. Speed is the one that
 * actually needs it: a bare number doesn't say what it does the way "Güç" or
 * "Yakıt" already do on their own.
 */
export const STAT_HINT = {
  attack: 'Verdiğin hasar',
  speed: '3+ fark: vur-kaç',
  health: 'Canın',
  cost: 'Kart maliyeti',
} as const;
