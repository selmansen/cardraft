import type { SupportAbilityKind } from '@/types';

/** Works for both the static SupportCard (design data) and a live
 *  SupportBattleCard (which names the same field `ability` instead of `kind`
 *  — pass `{ kind: c.ability, value: c.value }` for the latter). */
interface SupportEffectSource {
  kind: SupportAbilityKind;
  value: number;
}

/** Full sentence for a Pit Ekibi card's effect (inspector / target picker). */
export function supportCardEffectText(card: SupportEffectSource): string {
  switch (card.kind) {
    case 'HEAL_VEHICLE':
      return `Bir aracına anında ${card.value} can kazandırır.`;
    case 'HEAL_GARAGE':
      return `Garajına anında ${card.value} can kazandırır.`;
    case 'SHIELD':
      return `Seçtiğin aracın bir sonraki aldığı hasarı %${card.value} azaltır.`;
    case 'REDIRECT':
      return 'Rakibin garajına gelecek bir sonraki saldırıyı seçtiğin araca yönlendirir.';
    case 'AMBUSH':
      return `Rakibin rastgele bir aracına anında ${card.value} hasar verir.`;
    case 'FUEL_BOOST':
      return `Bu tur +${card.value} ekstra yakıt kazandırır.`;
    case 'FREE_PLAY':
      return 'Bu turki bir sonraki araç kartını ücretsiz oynatır.';
    case 'CANCEL_ATTACK':
      return 'Seçtiğin rakip aracı bir sonraki turda saldıramaz.';
    case 'DISABLE':
      return 'Seçtiğin rakip aracını 1 tur saldıramaz hale getirir.';
    case 'REVIVE':
      return '1 canı kalan bir aracını tam cana getirir.';
    case 'DISRUPT_HAND':
      return 'Rakibin elindeki kartları desteye karıştırıp yeniden çektirir.';
    default:
      return '';
  }
}
