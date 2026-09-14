import type { Ability, AbilityKind } from '@/types';

export const ABILITY_LABEL: Record<AbilityKind, string> = {
  RUSH: 'Atılım',
  NITRO: 'Nitro',
  RAM: 'Çarpma',
  BLOCKER: 'Siper',
  BACKFIRE: 'Egzoz Patlaması',
  CONVOY: 'Konvoy',
  WEAR: 'Yıpratma',
  TWIN: 'İkiz Vuruş',
};

export function abilityText(a: Ability): string {
  switch (a.kind) {
    case 'RUSH':
      return 'Atılım: sahaya çıktığı tur saldırabilir.';
    case 'NITRO':
      return `Nitro: girişte +${a.value ?? 0} güç ve hemen saldırır (bonus sıradaki turunda geçer).`;
    case 'RAM':
      return `Çarpma: girişte rastgele bir düşman araca ${a.value ?? 0} hasar.`;
    case 'BLOCKER':
      return 'Siper: düşman önce siper araçlara saldırmak zorunda; garaja vuramaz.';
    case 'BACKFIRE':
      return `Egzoz Patlaması: girişte rakip garaja ${a.value ?? 0} hasar.`;
    case 'CONVOY':
      return `Konvoy: yaşadığı sürece diğer araçların +${a.value ?? 0} güç.`;
    case 'WEAR':
      return `Yıpratma: sahada kaldığı her tur sonunda rastgele bir düşman araca ${a.value ?? 0} hasar.`;
    case 'TWIN':
      return 'İkiz Vuruş: bu turda iki kez saldırabilir.';
    default:
      return '';
  }
}

/** "Nitro ★★★ : 3+" — the value reads as stars (matches how rarity is shown
 *  elsewhere) but stays spelled out as a number too, so the actual game
 *  effect is never left to guessing what a star count means. */
export function abilityShort(a: Ability): string {
  const label = ABILITY_LABEL[a.kind];
  if (a.value == null) return `${label}:`;
  const stars = '★'.repeat(Math.max(1, Math.min(a.value, 5)));
  return `${label} ${stars} : ${a.value}+`;
}

/** "Nitro: girişte +2 güç…" → drop the "Label: " lead-in, keep the sentence —
 *  used next to abilityShort(), which already shows the label its own way. */
export function abilityDesc(a: Ability): string {
  const full = abilityText(a);
  return full.includes(': ') ? full.split(': ')[1] : full;
}
