/**
 * Child-safety constraint (see design doc §1): NO free text anywhere.
 * Communication is limited to this fixed set of template phrases + emojis.
 * In Faz 1 these are sent to the bot (cosmetic/fun only).
 */

export const QUICK_MESSAGES: string[] = [
  'İyi şanslar! 🤝',
  'İyi oyundu! 👏',
  'Vay canına! 😮',
  'Yakındı! 😅',
  'Hızlısın! 💨',
  'Sıra sende! 👉',
  'Tebrikler! 🏆',
  'Eyvah... 😬',
  'Bunu görmedim gelirken! 😵',
  'Rövanş? 🔁',
];

export const EMOJIS: string[] = [
  '🏎️',
  '🚙',
  '🔥',
  '💨',
  '😎',
  '😅',
  '👍',
  '🏁',
  '⚡',
  '🛞',
  '🏆',
  '😱',
];

/** Canned bot replies, chosen at random when the player sends something. */
export const BOT_REPLIES: string[] = [
  'İyi oyundu! 👏',
  'Hızlısın! 💨',
  'Sıra sende! 👉',
  '😎',
  '🔥',
  'Yakındı! 😅',
];
