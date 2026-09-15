import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CurrencyTag } from '@/components/Currency';
import { colors, font, LONG_PRESS_MS, radius, rarity as RARITY, shadow, text } from '@/constants/theme';
import { carImage } from '@/data/carImages';
import type { Card } from '@/types';

interface Props {
  card: Card;
  owned: boolean;
  /** 'browse' (dokunma detayı açar) ya da 'select' (dokunma kadroya alır). */
  mode?: 'browse' | 'select';
  /**
   * Kart kadroda mı?
   *
   * Tek prop — eskiden `selected` ve `inSquad` diye İKİSİ vardı ve aynı şeyi
   * anlatıyorlardı: biri seçim kipinde, diğeri gezinme kipinde okunuyordu.
   * Çağıran yalnızca `inSquad` gönderdiği için seçim kipinde kart hiç
   * değişmiyordu — oyuncu karta basıyor, kadroya giriyor ama kartta hiçbir
   * şey olmuyordu. İki isim, tek gerçek.
   */
  inSquad?: boolean;
  onPress: () => void;
  /** Press-and-hold to see full stats/abilities without triggering onPress
   *  (Squad uses this since a short tap there toggles squad membership
   *  instead of opening anything — Collection doesn't need it, its own tap
   *  already opens the full detail page). */
  onLongPress?: () => void;
}

/**
 * One card look everywhere — Collection and Squad show identical cards (name,
 * rarity, GÜÇ/HIZ/DAY) so the player can judge a vehicle without opening its
 * detail page. The only difference is behavioural: 'select' mode adds a
 * check-circle and toggles instead of navigating.
 */
function GameCardBase({ card, owned, mode = 'browse', inSquad, onPress, onLongPress }: Props) {
  const r = RARITY[card.rarity];
  const isSelect = mode === 'select';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? LONG_PRESS_MS : undefined}
      style={[
        styles.card,
        { borderColor: isSelect && inSquad ? colors.primary : r.border },
        isSelect && inSquad ? shadow.raised : shadow.card,
        !owned && styles.locked,
      ]}
    >
      <View style={[styles.art, { backgroundColor: r.art }]}>
        <Image source={carImage(card.id)} style={styles.artImg} resizeMode="cover" />

        {owned ? null : (
          // Kilitli kartta sadece jant fiyatı: coin karşılığı kart detayında
          // duruyor, ızgarada iki fiyat rozeti okunmuyor ve oyuncunun asıl
          // takip ettiği para birimi jant.
          <View style={styles.lockBadge}>
            <MaterialCommunityIcons name="lock" size={11} color={colors.ink} />
            <CurrencyTag currency="rim" amount={card.price.rim} size={text.bodySmall.fontSize} />
          </View>
        )}

        {/* Seçim işareti SAĞ ÜSTTE ve yalnızca seçiliyken — Pit Ekibi
            kartlarıyla aynı dil. Seçilmemiş kartta boş bir daire durması,
            ızgaradaki her kartın üstüne bir işaret koyup gözü yoruyordu;
            kilit rozeti zaten sol üstte, çakışma da yok. */}
        {isSelect && inSquad ? (
          <View style={styles.check}>
            <MaterialCommunityIcons name="check-bold" size={14} color="#FFFFFF" />
          </View>
        ) : !isSelect && inSquad ? (
          <View style={styles.squadTag}>
            <Text style={styles.squadTagText}>KADRODA</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {card.name}
        </Text>
        <View style={styles.rarityRow}>
          <RarityStars count={r.stars} color={r.border} />
          <Text style={styles.rarityText}>{r.label}</Text>
        </View>

        <View style={styles.stats}>
          <Stat icon="lightning-bolt" tint={colors.accent} v={card.attack} />
          <Stat icon="chevron-double-right" tint={colors.primary} v={card.speed} />
          <Stat icon="shield" tint={colors.success} v={card.health} />
          <Stat icon="water" tint={colors.primaryInk} v={card.cost} />
        </View>
      </View>
    </Pressable>
  );
}

// Icon instead of a text label (GÜÇ/HIZ/Dayanıklılık/YAKIT) — same mapping as
// the card detail page's StatBox, just without the label so 4 fit in a row.
function Stat({ icon, tint, v }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; v: number }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={14} color={tint} />
      <Text style={styles.statV}>{v}</Text>
    </View>
  );
}

/**
 * Rarity as a star ladder: Sıradan 0 (no stars), Nadir 1, Efsanevi 2,
 * Destansı 3 — reused on the card and on the detail page's rarity pill.
 */
export function RarityStars({ count, color, size = 10 }: { count: number; color: string; size?: number }) {
  if (count <= 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {Array.from({ length: count }).map((_, i) => (
        <MaterialCommunityIcons key={i} name="star" size={size} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  locked: { opacity: 0.6 },
  art: { position: 'relative', width: '100%', height: 104 },
  artImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  lockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  squadTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bubble,
  },
  squadTagText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.ink, letterSpacing: 0.4 },
  body: { padding: 10, paddingBottom: 11, gap: 7 },
  name: { fontFamily: font.headingSm, fontSize: 16, color: colors.ink },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rarityText: {
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  stats: { flexDirection: 'row', gap: 4 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    backgroundColor: colors.sunken,
    borderRadius: 8,
  },
  statV: { fontFamily: font.stat, fontSize: 15, color: colors.ink },
});

export const GameCard = memo(GameCardBase);
