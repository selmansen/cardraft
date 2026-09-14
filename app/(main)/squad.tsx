import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardInspectPanel } from '@/components/CardInspectPanel';
import { CategoryTabs } from '@/components/CategoryTabs';
import { CurrencyTag } from '@/components/Currency';
import { ChunkyButton } from '@/components/ChunkyButton';
import { GameCard } from '@/components/GameCard';
import { colors, font, NAV_CLEARANCE, radius, space, text } from '@/constants/theme';
import { CARDS, CLASS_LABEL } from '@/data/cards';
import { SUPPORT_CARDS } from '@/data/supportCards';
import { supportCardEffectText } from '@/game/supportAbilities';
import { LOADOUT_TOTAL, MAX_SUPPORT, MIN_VEHICLES, useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSupportCollection, useVehicleCollection } from '@/store/useCollection';
import { useWallet } from '@/store/useWallet';
import type { CurrencyCode } from '@/api/types';
import { VEHICLE_CLASSES, type Card, type SupportCard, type VehicleClass } from '@/types';

type Filter = 'all' | VehicleClass;
type Segment = 'vehicles' | 'support';

const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  ...VEHICLE_CLASSES.map((c) => ({ key: c, label: CLASS_LABEL[c] })),
];

export default function SquadScreen() {
  const router = useRouter();
  const collection = useVehicleCollection();
  const loadout = useGameStore((s) => s.loadout);
  const toggle = useGameStore((s) => s.toggleLoadout);
  const supportLoadout = useGameStore((s) => s.supportLoadout);
  const toggleSupport = useGameStore((s) => s.toggleSupportLoadout);
  const supportCollection = useSupportCollection();
  const unlockSupport = useSessionStore((s) => s.unlockCard);
  const { rims, coins, fromServer: online } = useWallet();
  const [segment, setSegment] = useState<Segment>('vehicles');
  const [filter, setFilter] = useState<Filter>('all');
  // Press-and-hold a vehicle to see its full stats/abilities — a short tap
  // here toggles squad membership instead of opening anything, so this is
  // the only way to check a card's ability without leaving the screen.
  const [inspect, setInspect] = useState<Card | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // A filter (or a segment switch — vehicle grid and Pit Ekibi grid are very
  // different heights) can jump from a short list to a much taller one or
  // back — without this, an old scroll offset that no longer exists makes
  // the ScrollView snap/bounce to a valid position on its own.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [filter, segment]);

  // Same card, same list as Collection — the only difference is tapping
  // toggles squad membership instead of opening the detail page.
  const owned = useMemo(
    () =>
      CARDS.filter((c) => collection.has(c.id)).sort(
        (a, b) => a.cost - b.cost || a.name.localeCompare(b.name),
      ),
    [collection],
  );
  const visible = useMemo(
    () => (filter === 'all' ? owned : owned.filter((c) => c.class === filter)),
    [owned, filter],
  );

  const done = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <View style={styles.crumbRow}>
        <Pressable style={styles.back} onPress={done}>
          <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Menü</Text>
        </Pressable>
        <View style={styles.countPill}>
          <Text style={styles.countText}>
            {loadout.length + supportLoadout.length}/{LOADOUT_TOTAL}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>Kadronu Düzenle</Text>

      {/* Deliberately NOT another CategoryTabs pill — a vehicle vs. Pit Ekibi
          card is a different card type, not just another category, so this
          switch is visually its own thing: full-width, two big buttons. The
          category tabs below only ever filter within "Saha Ekibi". */}
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segmentBtn, segment === 'vehicles' && styles.segmentBtnOn]}
          onPress={() => setSegment('vehicles')}
        >
          <MaterialCommunityIcons name="truck" size={14} color={segment === 'vehicles' ? '#FFFFFF' : colors.textMuted} />
          <Text style={[styles.segmentText, segment === 'vehicles' && styles.segmentTextOn]}>
            Saha Ekibi <Text style={styles.segmentCount}>({loadout.length})</Text>
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, segment === 'support' && styles.segmentBtnOnAlt]}
          onPress={() => setSegment('support')}
        >
          <MaterialCommunityIcons name="wrench" size={14} color={segment === 'support' ? '#FFFFFF' : colors.grapeInk} />
          <Text style={[styles.segmentText, segment === 'support' && styles.segmentTextOn]}>
            Pit Ekibi <Text style={styles.segmentCount}>({supportLoadout.length})</Text>
          </Text>
        </Pressable>
      </View>

      {segment === 'vehicles' ? (
        <>
          <Text style={styles.help} numberOfLines={2}>
            Savaşa çıkaracağın en az {MIN_VEHICLES} aracını seç! Eklemek ya da çıkarmak için karta
            dokunman yeterli.
          </Text>
          <CategoryTabs options={CHIPS} value={filter} onChange={setFilter} />
        </>
      ) : (
        <Text style={styles.help} numberOfLines={2}>
          Yanında taşıyacağın en fazla {MAX_SUPPORT} kart seç. Yakıt harcamazlar, sahaya çıkmazlar,
          turda en fazla 1 tanesi kullanılır.
        </Text>
      )}

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
        {segment === 'vehicles' ? (
          visible.length === 0 ? (
            <Text style={styles.empty}>Bu kategoride henüz açık aracın yok.</Text>
          ) : (
            <View style={styles.grid}>
              {visible.map((card) => {
                return (
                  <View key={card.id} style={styles.cell}>
                    <GameCard
                      card={card}
                      owned
                      mode="select"
                      selected={loadout.includes(card.id)}
                      onPress={() => toggle(card.id)}
                      onLongPress={() => setInspect(card)}
                    />
                  </View>
                );
              })}
            </View>
          )
        ) : (
          <View style={styles.grid}>
            {SUPPORT_CARDS.map((card) => {
              const owned = supportCollection.has(card.id);
              const selected = supportLoadout.includes(card.id);
              return (
                <Pressable
                  key={card.id}
                  style={[styles.pitCard, selected && styles.pitCardOn, !owned && styles.pitCardLocked]}
                  onPress={() =>
                    owned ? toggleSupport(card.id) : askUnlock(card, { rims, coins }, online, unlockSupport)
                  }
                >
                  <Text style={styles.pitEmoji}>{card.emoji}</Text>
                  <Text style={styles.pitName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={styles.pitEffect} numberOfLines={3}>
                    {supportCardEffectText(card)}
                  </Text>
                  <View style={styles.pitFoot}>
                    <PowerDots power={card.power} />
                    {owned ? null : (
                      <CurrencyTag currency="rim" amount={card.price.rim} size={11} />
                    )}
                  </View>
                  {selected ? (
                    <View style={styles.pitCheck}>
                      <MaterialCommunityIcons name="check-bold" size={11} color="#FFFFFF" />
                    </View>
                  ) : owned ? null : (
                    <View style={styles.pitLock}>
                      <MaterialCommunityIcons name="lock" size={11} color={colors.ink} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <ChunkyButton variant="primary" label="KAYDET" onPress={done} style={{ marginTop: space.sm }} />
      </ScrollView>

      {inspect ? (
        <CardInspectPanel card={inspect} onClose={() => setInspect(null)} />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Pit Ekibi kartlarının nadirliği yok, GÜÇ SEVİYESİ var (1–4) ve fiyat buna
 * bağlı. Nokta merdiveni araç kartlarındaki yıldızların karşılığı: oyuncu
 * neden birinin diğerinden pahalı olduğunu kart üzerinde görsün.
 */
function PowerDots({ power }: { power: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.dot, i <= power && styles.dotOn]} />
      ))}
    </View>
  );
}

/**
 * Kilitli bir Pit Ekibi kartına dokunulduğunda: jant mı coin mi. Araç
 * kartındaki iki butonlu akışın buradaki karşılığı — destek kartlarının ayrı
 * bir detay sayfası yok, o yüzden seçim doğrudan burada soruluyor.
 */
function askUnlock(
  card: SupportCard,
  wallet: { rims: number; coins: number },
  online: boolean,
  unlock: (cardId: string, currency: CurrencyCode) => Promise<string | null>,
) {
  // Kilit açmak sunucu işi (bakiye ve koleksiyon orada). Çevrimdışıyken
  // denemenin anlamı yok — hata mesajı göstermektense baştan söylüyoruz.
  if (!online) {
    Alert.alert(card.name, 'Kart açmak için internet bağlantısı gerekiyor.');
    return;
  }

  const withRim = card.price.rim > 0 && wallet.rims >= card.price.rim;
  const withCoin = card.price.coin > 0 && wallet.coins >= card.price.coin;
  if (!withRim && !withCoin) {
    Alert.alert(
      card.name,
      `Bu kart için ${card.price.rim} jant ya da ${card.price.coin} coin gerekiyor. Elinde ${wallet.rims} jant var.`,
    );
    return;
  }

  // Sonucu SUNUCU söylüyor: burada gösterilen fiyat sadece bilgi, gerçek
  // kontrol (ve tahsilat) sunucuda tek transaction içinde yapılıyor.
  const buy = async (currency: CurrencyCode) => {
    const error = await unlock(card.id, currency);
    if (error) Alert.alert(card.name, error);
  };

  Alert.alert(card.name, 'Bu Pit Ekibi kartının kilidini nasıl açalım?', [
    { text: 'Vazgeç', style: 'cancel' },
    ...(withRim ? [{ text: `${card.price.rim} jant`, onPress: () => void buy('RIM') }] : []),
    ...(withCoin ? [{ text: `${card.price.coin} coin`, onPress: () => void buy('COIN') }] : []),
  ]);
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
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: space.md,
    marginTop: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.sunken,
  },
  segmentBtnOn: { backgroundColor: colors.primary },
  segmentBtnOnAlt: { backgroundColor: colors.grape },
  segmentText: { fontFamily: font.bodyBold, fontSize: text.small.fontSize, color: colors.textMuted },
  segmentCount: { fontFamily: font.body, fontSize: text.caption.fontSize },
  segmentTextOn: { color: '#FFFFFF' },
  // Two lines' worth of room whether the copy fills them or not — keeps the
  // tab row at an identical y regardless of which segment's help text shows.
  help: {
    fontFamily: font.body,
    fontSize: text.small.fontSize,
    lineHeight: text.small.lineHeight,
    height: text.small.lineHeight * 2,
    color: colors.textMuted,
    paddingHorizontal: space.md,
    marginTop: 8,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: NAV_CLEARANCE + space.lg,
    gap: 12,
  },
  empty: { fontFamily: font.body, fontSize: text.small.fontSize, color: colors.textFaint, textAlign: 'center', paddingVertical: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47%' },
  pitCard: {
    width: '47%',
    gap: 4,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  pitCardOn: { borderColor: colors.grape, backgroundColor: colors.grapeSoft },
  pitCardLocked: { opacity: 0.62 },
  pitFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.grape },
  pitLock: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitEmoji: { fontSize: 20 },
  pitName: { fontFamily: font.bodyBold, fontSize: text.small.fontSize, color: colors.ink },
  pitEffect: {
    fontFamily: font.body,
    fontSize: text.caption.fontSize,
    lineHeight: text.caption.lineHeight,
    color: colors.textMuted,
  },
  pitCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.grape,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
