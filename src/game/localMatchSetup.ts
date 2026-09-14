import { makeBotLoadout, makeBotSupportLoadout } from '@/game/botDeck';
import { DIFFICULTY, type Difficulty } from '@/game/difficulty';
import type { LoadoutEntry } from '@/game/battleEngine';

/**
 * Bir maçın kurulumu: kim kime karşı, hangi ayarlarla.
 *
 * Çevrimiçiyken sunucudan gelir, çevrimdışıyken buradan üretilir.
 */
export interface MatchSetup {
  /** Sunucudaki oturum. `null` = çevrimdışı oynanıyor, ÖDÜL YOK. */
  matchId: string | null;
  /** Sunucudan gelen tohum; çevrimdışında undefined (yerel rastgelelik). */
  seed?: string;
  botLoadout: LoadoutEntry[];
  botSupportLoadout: string[];
  botGarageHp: number;
  playerGarageHp: number;
  playerOpeningHand: number;
  botOpeningHand: number;
  botBlunderChance: number;
}

/**
 * Çevrimdışı kurulum: aynı motor, aynı zorluk ayarları, ama tohum yerelden ve
 * `matchId` yok. Ödül verilmemesinin sebebi bu — sunucu bu maçı doğrulayamaz,
 * dolayısıyla jant yazamaz (ADR 0007).
 *
 * Ağ katmanından AYRI bir dosyada duruyor: çevrimdışı bir maç kurmanın HTTP
 * ile hiçbir ilgisi yok, ve aynı modülde olsaydı bu kod yolu ancak bütün API
 * yığını ayakta olduğunda test edilebilirdi.
 */
export function localMatchSetup(difficulty: Difficulty, battlesWon: number): MatchSetup {
  const preset = DIFFICULTY[difficulty];
  return {
    matchId: null,
    botLoadout: makeBotLoadout(battlesWon),
    botSupportLoadout: makeBotSupportLoadout(3, battlesWon),
    botGarageHp: preset.botGarageHp,
    playerGarageHp: preset.playerGarageHp,
    playerOpeningHand: preset.playerOpeningHand,
    botOpeningHand: preset.botOpeningHand,
    botBlunderChance: preset.botBlunderChance,
  };
}
