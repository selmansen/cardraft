import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, rarity as RAR, shadow, text } from '@/constants/theme';
import { CLASS_LABEL } from '@/data/cards';
import { carImage } from '@/data/carImages';
import { abilityDesc, abilityShort } from '@/game/abilities';
import { STAT_HINT } from '@/game/statLegend';
import type { Card } from '@/types';

import { RarityStars } from './GameCard';

/**
 * The "what does this card actually do" overlay — press-and-hold on a card
 * anywhere it's shown as a static Card (not a live battle Vehicle; battle.tsx
 * has its own InspectPanel for that, fed by live HP/temp-attack instead of a
 * fixed level). Same visual language in both places on purpose: this is now
 * a single app-wide gesture, not a per-screen quirk.
 */
export function CardInspectPanel({ card, onClose }: { card: Card; onClose: () => void }) {
  const r = RAR[card.rarity];

  return (
    <Pressable style={styles.scrim} onPress={onClose}>
      <Pressable style={styles.panel} onPress={() => {}}>
        <View style={[styles.hero, { backgroundColor: r.art }]}>
          <Image source={carImage(card.id)} style={styles.heroImg} resizeMode="cover" />
          <Pressable style={styles.close} onPress={onClose}>
            <MaterialCommunityIcons name="close-thick" size={15} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{card.name}</Text>

          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: r.pill }]}>
              <RarityStars count={r.stars} color={r.border} size={11} />
              <Text style={[styles.pillText, { color: r.ink }]}>{r.label}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.sunken }]}>
              <Text style={[styles.pillText, { color: colors.inkSoft }]}>{CLASS_LABEL[card.class]}</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Stat icon="lightning-bolt" tint={colors.accent} label="Güç" value={card.attack} hint={STAT_HINT.attack} />
            <Stat icon="chevron-double-right" tint={colors.primary} label="Hız" value={card.speed} hint={STAT_HINT.speed} />
            <Stat icon="shield" tint={colors.success} label="Dayanıklılık" value={card.health} hint={STAT_HINT.health} />
            <Stat icon="water" tint={colors.primaryInk} label="Yakıt" value={card.cost} hint={STAT_HINT.cost} />
          </View>

          {card.abilities.length === 0 ? (
            <Text style={styles.none}>Özel yeteneği yok. Saf güç.</Text>
          ) : (
            <View style={styles.abilities}>
              {card.abilities.map((a, i) => (
                <View
                  key={i}
                  style={[styles.abilityRow, i < card.abilities.length - 1 && styles.abilityDivider]}
                >
                  <View style={styles.dot} />
                  <Text style={styles.line}>
                    <Text style={styles.label}>{abilityShort(a)} </Text>
                    {abilityDesc(a)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Pressable>
  );
}

function Stat({
  icon,
  tint,
  label,
  value,
  hint,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={14} color={tint} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statHint} numberOfLines={2}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,18,28,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 260,
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.raised,
  },
  hero: { height: 130, position: 'relative' },
  heroImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  body: { padding: 16, gap: 12 },
  name: { fontFamily: font.display, fontSize: 20, color: colors.ink },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pillText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, letterSpacing: 0.4 },
  statRow: { flexDirection: 'row', gap: 6 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: colors.sunken,
    borderRadius: 12,
  },
  statValue: { fontFamily: font.stat, fontSize: 15, color: colors.ink },
  statLabel: { fontFamily: font.bodyBold, fontSize: 9, lineHeight: 11, color: colors.textFaint, textAlign: 'center' },
  statHint: { fontFamily: font.body, fontSize: 8, lineHeight: 10, color: colors.textFaint, textAlign: 'center', marginTop: 1 },
  abilities: { backgroundColor: colors.sunken, borderRadius: radius.md, overflow: 'hidden' },
  abilityRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12 },
  abilityDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 6, height: 6, marginTop: 6, borderRadius: 3, backgroundColor: colors.accent },
  line: { flex: 1, fontFamily: font.body, fontSize: text.bodySmall.fontSize, lineHeight: text.bodySmall.lineHeight, color: colors.inkSoft },
  label: { fontFamily: font.bodyBold, color: colors.ink },
  none: { fontFamily: font.body, fontSize: text.body.fontSize, color: colors.textFaint },
});
