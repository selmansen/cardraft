import { GARAGE_HP } from './battleEngine';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultyPreset {
  label: string;
  blurb: string;
  botGarageHp: number;
  playerGarageHp: number;
  playerOpeningHand: number;
  botOpeningHand: number;
  /** 0..1 — chance the bot makes a deliberately weak move at each decision. */
  botBlunderChance: number;
  /**
   * Maç ödülünün çarpanı. Zorluk seçimi yoksa herkes Kolay'da farmlar ve
   * seçim süs olur; ödülü zorluğa bağlamak seçimi gerçek bir tercih yapıyor.
   */
  rewardMultiplier: number;
}

/**
 * Maç ödülü (jant). Hedef: ~28 maçta bir destansı kart (3600 jant).
 * Normal zorlukta %65 kazanma varsayımıyla maç başı ortalama
 * 0.65·170 + 0.35·55 ≈ 130 jant → 3600 / 130 ≈ 28 maç.
 * Kaybedince de ödül var: sıfır ödül, kaybeden oyuncuyu oyunu kapatmaya iter.
 */
export const WIN_REWARD = 170;
export const LOSS_REWARD = 55;

/** Bir maçın jant ödülü — tek kaynak, hem istemci hem sunucu bunu kullanır. */
export function battleReward(won: boolean, difficulty: Difficulty): number {
  const base = won ? WIN_REWARD : LOSS_REWARD;
  return Math.round(base * DIFFICULTY[difficulty].rewardMultiplier);
}

export const DIFFICULTY: Record<Difficulty, DifficultyPreset> = {
  easy: {
    label: 'Kolay',
    blurb: 'Bot garajı 20 (seninki 30), açılışta 4 kart, bot bol bol hata yapar. Yeni başlayanlara özel!',
    botGarageHp: 20,
    playerGarageHp: GARAGE_HP,
    playerOpeningHand: 4,
    botOpeningHand: 3,
    botBlunderChance: 0.35,
    rewardMultiplier: 0.8,
  },
  normal: {
    label: 'Normal',
    blurb: 'Bot garajı 28, açılış eşit. Bot artık kafasına göre değil, mantıklı oynuyor.',
    botGarageHp: 28,
    playerGarageHp: GARAGE_HP,
    playerOpeningHand: 3,
    botOpeningHand: 3,
    botBlunderChance: 0.12,
    rewardMultiplier: 1,
  },
  hard: {
    label: 'Zor',
    blurb: 'Bot garajı 34, eli 4 kart, hiç hata yapmaz. Gerçek bir meydan okuma!',
    botGarageHp: 34,
    playerGarageHp: GARAGE_HP,
    playerOpeningHand: 3,
    botOpeningHand: 4,
    botBlunderChance: 0,
    rewardMultiplier: 1.35,
  },
};
