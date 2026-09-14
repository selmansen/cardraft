import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CurrencyCode } from '@/api/types';
import { CardInspectPanel } from '@/components/CardInspectPanel';
import { CategoryTabs } from '@/components/CategoryTabs';
import { CurrencyTag } from '@/components/Currency';
import { GameCard } from '@/components/GameCard';
import { colors, font, NAV_CLEARANCE, radius, rarity, shadow, space, text } from '@/constants/theme';
import { CARDS, CLASS_LABEL, getCard } from '@/data/cards';
import { SUPPORT_CARDS } from '@/data/supportCards';
import { supportCardEffectText } from '@/game/supportAbilities';
import { LOADOUT_TOTAL, MAX_SUPPORT, MIN_VEHICLES, useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSupportCollection, useVehicleCollection } from '@/store/useCollection';
import { useWallet } from '@/store/useWallet';
import { VEHICLE_CLASSES, type Card, type SupportCard, type VehicleClass } from '@/types';

/** 'pit' araç kategorileriyle aynı çip sırasında duruyor: ayrı bir segment
 *  düğmesi "iki ayrı ekran" hissini geri getirirdi. */
type Filter = 'all' | VehicleClass | 'pit';

const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  ...VEHICLE_CLASSES.map((c) => ({ key: c as Filter, label: CLASS_LABEL[c] })),
  { key: 'pit', label: 'Pit Ekibi' },
];

/**
 * GARAJ — kadro ve koleksiyon tek ekranda.
 *
 * Eskiden bunlar iki AYRI ekrandı (Kadro ve Koleksiyon) ve oyuncu
 * koleksiyonda kart seçerken kadrosunu görmüyordu: körlemesine deste
 * kuruyordu. Kadro artık yukarıda sabit, koleksiyon altında kayıyor.
 *
 * Üç kart durumu üç farklı GÖRÜNÜM alıyor, çünkü dokunma sonuçları farklı:
 * kadroda (tik → çıkarır), sahip (boş daire → ekler), kilitli (fiyat →
 * satın alma ekranı). Aynı görünüp farklı davranmak kafa karıştırırdı.
 */
export default function GarageScreen() {
  const router = useRouter();
  const loadout = useGameStore((s) => s.loadout);
  const supportLoadout = useGameStore((s) => s.supportLoadout);
  const toggle = useGameStore((s) => s.toggleLoadout);
  const toggleSupport = useGameStore((s) => s.toggleSupportLoadout);
  const vehicles = useVehicleCollection();
  const support = useSupportCollection();
  const unlock = useSessionStore((s) => s.unlockCard);
  const { rims, coins, fromServer: online } = useWallet();

  const [filter, setFilter] = useState<Filter>('all');
  const [inspect, setInspect] = useState<Card | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Filtre değişince başa dön: kısa bir listeden uzun bir listeye (ya da
  // tersine) geçildiğinde eski kaydırma konumu artık var olmuyor ve
  // ScrollView kendi başına geçerli bir yere zıplıyor.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [filter]);

  const total = loadout.length + supportLoadout.length;
  const showPit = filter === 'pit';

  const vehicleList = useMemo(() => {
    const list = filter === 'all' || filter === 'pit' ? CARDS : CARDS.filter((c) => c.class === filter);
    return [...list].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [filter]);

  function onVehiclePress(card: Card) {
    // Sahip olunan kart kadroya girer/çıkar; kilitli kart satın alma
    // ekranına götürür. İki farklı sonuç, iki farklı görünüm (bkz. GameCard).
    if (!vehicles.has(card.id)) {
      router.push(`/card/${card.id}`);
      return;
    }
    if (!loadout.includes(card.id) && total >= LOADOUT_TOTAL) {
      Alert.alert('Kadro dolu', `Kadroda ${LOADOUT_TOTAL} kart var. Önce birini çıkar.`);
      return;
    }
    toggle(card.id);
  }

  function onSupportPress(card: SupportCard) {
    if (!support.has(card.id)) {
      void unlockSupport(card, { rims, coins }, online, unlock);
      return;
    }
    const inSquad = supportLoadout.includes(card.id);
    if (!inSquad && supportLoadout.length >= MAX_SUPPORT) {
      Alert.alert('Pit Ekibi dolu', `En fazla ${MAX_SUPPORT} Pit Ekibi kartı taşıyabilirsin.`);
      return;
    }
    if (!inSquad && total >= LOADOUT_TOTAL) {
      Alert.alert('Kadro dolu', `Kadroda ${LOADOUT_TOTAL} kart var. Önce birini çıkar.`);
      return;
    }
    toggleSupport(card.id);
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Garaj</Text>
        <View style={styles.walletPill}>
          <CurrencyTag currency="rim" amount={rims} size={14} />
        </View>
      </View>

      {/* KADRO — sabit. Ne kurduğunu görmeden kart seçmek körlemesine deste
          kurmak demek; bu yüzden kaydırmayla yukarı kaçmıyor. */}
      <View style={styles.squadBlock}>
        <View style={styles.squadHead}>
          <Text style={styles.squadLabel}>KADRON</Text>
          <Text style={[styles.squadCount, total !== LOADOUT_TOTAL && styles.squadCountWarn]}>
            {total} / {LOADOUT_TOTAL}
            <Text style={styles.squadDetail}>
              {'  '}· {loadout.length} araç · {supportLoadout.length} pit
            </Text>
          </Text>
        </View>

        <View style={styles.squadStrip}>
          {loadout.map((id) => {
            const tint = rarity[getCard(id).rarity];
            return (
              <Pressable
                key={id}
                style={[styles.slot, { backgroundColor: tint.art, borderColor: tint.border }]}
                onPress={() => toggle(id)}
              >
                <View style={styles.slotRemove}>
                  <MaterialCommunityIcons name="minus" size={9} color="#FFFFFF" />
                </View>
              </Pressable>
            );
          })}
          {loadout.length < MIN_VEHICLES && (
            <View style={styles.slotEmpty}>
              <MaterialCommunityIcons name="plus" size={14} color={colors.textFaint} />
            </View>
          )}

          {supportLoadout.length > 0 && <View style={styles.divider} />}
          {supportLoadout.map((id) => (
            <Pressable
              key={id}
              style={[styles.slot, styles.pitSlot]}
              onPress={() => toggleSupport(id)}
            >
              <MaterialCommunityIcons name="wrench" size={15} color={colors.bubble} />
              <View style={styles.slotRemove}>
                <MaterialCommunityIcons name="minus" size={9} color="#FFFFFF" />
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.chips}>
        <CategoryTabs options={CHIPS} value={filter} onChange={setFilter} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {showPit
            ? SUPPORT_CARDS.map((card) => (
                <View key={card.id} style={styles.cell}>
                  <PitCard
                    card={card}
                    owned={support.has(card.id)}
                    inSquad={supportLoadout.includes(card.id)}
                    onPress={() => onSupportPress(card)}
                  />
                </View>
              ))
            : vehicleList.map((card) => (
                <View key={card.id} style={styles.cell}>
                  <GameCard
                    card={card}
                    owned={vehicles.has(card.id)}
                    mode="select"
                    inSquad={loadout.includes(card.id)}
                    onPress={() => onVehiclePress(card)}
                    onLongPress={() => setInspect(card)}
                  />
                </View>
              ))}
        </View>

        <View style={styles.hint}>
          <MaterialCommunityIcons name="information-outline" size={17} color={colors.accentDark} />
          <Text style={styles.hintText}>
            Karta basılı tut: özelliklerini gör. Kilitli karta dokun: satın al.
          </Text>
        </View>
      </ScrollView>

      {inspect && <CardInspectPanel card={inspect} onClose={() => setInspect(null)} />}
    </SafeAreaView>
  );
}

/** Pit kartı — araç kartıyla aynı anatomiye sahip değil (stat yok, etki
 *  metni var), o yüzden ayrı ama aynı üç durumu gösteriyor. */
function PitCard({
  card,
  owned,
  inSquad,
  onPress,
}: {
  card: SupportCard;
  owned: boolean;
  inSquad: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.pit, inSquad && styles.pitOn, !owned && styles.pitLocked]}
      onPress={onPress}
    >
      <View style={styles.pitIcon}>
        <MaterialCommunityIcons name="wrench" size={20} color={colors.bubble} />
      </View>
      <Text style={styles.pitName} numberOfLines={1}>
        {card.name}
      </Text>
      <Text style={styles.pitEffect} numberOfLines={2}>
        {supportCardEffectText(card)}
      </Text>
      {owned ? (
        <View style={[styles.badge, inSquad && styles.badgeOn]}>
          {inSquad && <MaterialCommunityIcons name="check" size={11} color="#FFFFFF" />}
        </View>
      ) : (
        <View style={styles.priceBadge}>
          <CurrencyTag currency="rim" amount={card.price.rim} size={10} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Pit kartının kilidini açar.
 *
 * Kart detayı ekranı yalnızca araçlar için var; pit kartının ayrı bir sayfası
 * olmadığı için satın alma burada bir uyarıyla sorulup sunucuya gidiyor.
 * Gösterilen fiyat bilgi amaçlı — gerçek kontrol ve tahsilat sunucuda tek
 * transaction içinde.
 */
async function unlockSupport(
  card: SupportCard,
  wallet: { rims: number; coins: number },
  online: boolean,
  unlock: (cardId: string, currency: CurrencyCode) => Promise<string | null>,
) {
  if (!online) {
    Alert.alert(card.name, 'Kart açmak için internet bağlantısı gerekiyor.');
    return;
  }

  const withRim = card.price.rim > 0 && wallet.rims >= card.price.rim;
  const withCoin = card.price.coin > 0 && wallet.coins >= card.price.coin;
  if (!withRim && !withCoin) {
    Alert.alert(
      card.name,
      `Bu kart için ${card.price.rim} jant gerekiyor. Elinde ${wallet.rims} jant var.`,
    );
    return;
  }

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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  title: { fontFamily: font.heading, fontSize: 26, lineHeight: 32, color: colors.ink },
  walletPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  squadBlock: { paddingHorizontal: space.md, paddingTop: 12 },
  squadHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  squadLabel: {
    fontFamily: font.bodyBold,
    fontSize: text.caption.fontSize,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  squadCount: { fontFamily: font.bodyBlack, fontSize: text.small.fontSize, color: colors.successInk },
  squadCountWarn: { color: colors.accentDark },
  squadDetail: { fontFamily: font.bodyBold, fontSize: text.caption.fontSize, color: colors.textFaint },
  squadStrip: {
    flexDirection: 'row',
    gap: 5,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    ...shadow.card,
  },
  slot: { width: 40, height: 54, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pitSlot: { backgroundColor: '#FFE4EE', borderColor: colors.bubble },
  slotEmpty: {
    width: 40,
    height: 54,
    borderRadius: 9,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: 1, backgroundColor: colors.border, marginVertical: 4, marginHorizontal: 3 },

  chips: { paddingTop: space.md },
  scroll: { paddingHorizontal: space.md, paddingTop: 12, paddingBottom: NAV_CLEARANCE },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  cell: { width: '31.5%', aspectRatio: 0.72 },

  pit: {
    flex: 1,
    padding: 8,
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    ...shadow.card,
  },
  pitOn: { borderColor: colors.bubble },
  pitLocked: { opacity: 0.72 },
  pitIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FFE4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitName: { fontFamily: font.headingSm, fontSize: 12, lineHeight: 15, color: colors.ink },
  pitEffect: {
    fontFamily: font.body,
    fontSize: text.micro.fontSize,
    lineHeight: text.micro.lineHeight,
    color: colors.textMuted,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: { backgroundColor: colors.bubble, borderColor: colors.surface },
  priceBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },

  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 12,
    padding: 11,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
  },
  hintText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: text.caption.fontSize,
    lineHeight: text.caption.lineHeight,
    color: colors.ink,
  },
});
