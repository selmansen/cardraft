import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { SupportAbilityKind } from '@/types';

/**
 * Pit Ekibi kartlarının ikonları.
 *
 * Hepsi aynı anahtar ikonuyla gösteriliyordu ve kartlar birbirinden yalnızca
 * adlarıyla ayrılıyordu — yani hızlıca bakan oyuncu için görsel bir bilgi
 * taşımıyorlardı. Araç kartlarının nadirlik rengi neyse, pit kartları için de
 * bu: ne işe yaradığını okumadan önce gösteren şey.
 *
 * Eşleme yeteneğin TÜRÜNE bağlı, kartın adına değil: yeni bir kart aynı türde
 * bir yetenekle eklendiğinde ikonu kendiliğinden doğru geliyor.
 */
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const SUPPORT_ICON: Record<SupportAbilityKind, IconName> = {
  HEAL_VEHICLE: 'wrench',
  HEAL_GARAGE: 'home-heart',
  SHIELD: 'shield',
  REDIRECT: 'arrow-decision',
  AMBUSH: 'target',
  FUEL_BOOST: 'lightning-bolt',
  FREE_PLAY: 'gift',
  CANCEL_ATTACK: 'cancel',
  DISABLE: 'engine-off',
  REVIVE: 'heart-pulse',
  DISRUPT_HAND: 'cards-outline',
};
