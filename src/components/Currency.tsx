import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, font, radius, shadow, text } from '@/constants/theme';
import type { Currency } from '@/types';

/**
 * İki para biriminin tek görsel tanımı. Jant ve coin dört ayrı ekranda
 * gösteriliyor (menü, kart detayı, koleksiyon rozeti, Pit Ekibi kartı); ikon
 * ve rengi her birinde ayrı yazmak, birini değiştirdiğimizde diğerlerinin
 * geride kalması demek olurdu.
 */
export const CURRENCY: Record<
  Currency,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; soft: string; label: string }
> = {
  // Jant = oynayarak kazanılan (LoL'de mavi öz) → sakin mavi.
  rim: { icon: 'tire', tint: colors.primaryInk, soft: colors.primarySoft, label: 'Jant' },
  // Coin = satın alınan (LoL'de RP) → sıcak altın; premium okunsun.
  coin: { icon: 'circle-multiple', tint: colors.accentDark, soft: colors.accentSoft, label: 'Coin' },
};

/** İkon + rakam. Rozet, buton içi fiyat, bakiye — hepsi bunu kullanır. */
export function CurrencyTag({
  currency,
  amount,
  size = 13,
  color,
  style,
}: {
  currency: Currency;
  amount: number;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = CURRENCY[currency];
  return (
    <View style={[styles.tag, style]}>
      <MaterialCommunityIcons name={c.icon} size={size} color={color ?? c.tint} />
      <Text style={[styles.tagText, { fontSize: size, color: color ?? colors.ink }]}>{amount}</Text>
    </View>
  );
}

/** Ekranların sağ üstündeki cüzdan: jant ve coin yan yana, tek kapsül. */
export function WalletPill({ rims, coins }: { rims: number; coins: number }) {
  return (
    <View style={styles.wallet}>
      <CurrencyTag currency="rim" amount={rims} size={14} />
      <View style={styles.walletSep} />
      <CurrencyTag currency="coin" amount={coins} size={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontFamily: font.stat },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  walletSep: { width: 1, height: 14, backgroundColor: colors.border },
  caption: { fontFamily: font.body, fontSize: text.bodySmall.fontSize },
});
