import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryTabs } from '@/components/CategoryTabs';
import { GameCard } from '@/components/GameCard';
import { colors, font, NAV_CLEARANCE, radius, space, text } from '@/constants/theme';
import { CARDS, CLASS_LABEL } from '@/data/cards';
import { useGameStore } from '@/store/gameStore';
import { useVehicleCollection } from '@/store/useCollection';
import { VEHICLE_CLASSES, type VehicleClass } from '@/types';

type Filter = 'all' | VehicleClass;

const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  ...VEHICLE_CLASSES.map((c) => ({ key: c, label: CLASS_LABEL[c] })),
];

export default function CollectionScreen() {
  const router = useRouter();
  const collection = useVehicleCollection();
  const loadout = useGameStore((s) => s.loadout);
  const [filter, setFilter] = useState<Filter>('all');
  const scrollRef = useRef<ScrollView>(null);
  // Same reasoning as Squad: a filter can jump from a short list to a much
  // taller one (or back), and an old scroll offset that no longer exists in
  // the new content makes the ScrollView snap/bounce to a valid one on its own.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [filter]);

  const ownedCount = collection.count;

  const cards = useMemo(() => {
    const list = filter === 'all' ? CARDS : CARDS.filter((c) => c.class === filter);
    return [...list].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [filter]);

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      {/* Header mirrors Squad's exactly (fixed-height crumb row + two-line
          description) so the category tabs sit on the same line there and here. */}
      <View style={styles.crumbRow}>
        <Pressable style={styles.back} onPress={() => router.replace('/')}>
          <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Menü</Text>
        </Pressable>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{ownedCount} / {CARDS.length}</Text>
        </View>
      </View>

      <Text style={styles.title}>Koleksiyon</Text>
      <Text style={styles.help} numberOfLines={2}>
        Araçlarına dokun, detaylarını incele. Kilitli olanların kilidini de tam burada açabilirsin.
      </Text>

      <CategoryTabs options={CHIPS} value={filter} onChange={setFilter} />

      {/* An explicit flex:1 was missing — without it a ScrollView inside a
          flex column has no bounded height of its own to lay out against, so
          how it (and its siblings above it, like the tabs) measured could
          vary with content length instead of staying fixed regardless of it. */}
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.grid}>
        {cards.map((card) => {
          return (
            <View key={card.id} style={styles.cell}>
              <GameCard
                card={card}
                owned={collection.has(card.id)}
                inSquad={loadout.includes(card.id)}
                onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
              />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  // Fixed height: the count pill can grow/shrink without moving anything below it.
  crumbRow: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    marginTop: space.sm,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  backText: { fontFamily: font.bodyBold, fontSize: text.small.fontSize, color: colors.textMuted },
  countPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  countText: { fontFamily: font.stat, fontSize: text.caption.fontSize, color: colors.primaryInk },
  title: { fontFamily: font.display, fontSize: 22, color: colors.ink, paddingHorizontal: space.md, marginTop: 6 },
  // Two lines' worth of room whether the copy fills them or not — keeps the
  // tab row at an identical y on Squad and Collection.
  help: {
    fontFamily: font.body,
    fontSize: text.small.fontSize,
    lineHeight: text.small.lineHeight,
    height: text.small.lineHeight * 2,
    color: colors.textMuted,
    paddingHorizontal: space.md,
    marginTop: 4,
  },
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: NAV_CLEARANCE + space.lg,
    gap: 12,
  },
  cell: { width: '47%' },
});
