import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CurrencyCode } from '@/api/types';
import { CardInspectPanel } from '@/components/CardInspectPanel';
import { EmptySlot, SquadSlot } from '@/components/SquadSlot';
import { SUPPORT_ICON } from '@/data/supportIcons';
import { CategoryTabs } from '@/components/CategoryTabs';
import { CurrencyTag } from '@/components/Currency';
import { useDialog, type DialogOptions } from '@/components/overlay/DialogProvider';
import { GameCard } from '@/components/GameCard';
import { CARD_INSPECT_MS, colors, font, NAV_CLEARANCE, radius, shadow, space, text } from '@/constants/theme';
import { CARDS, CLASS_LABEL } from '@/data/cards';
import { SUPPORT_CARDS } from '@/data/supportCards';
import { supportCardEffectText } from '@/game/supportAbilities';
import { LOADOUT_TOTAL, MAX_SUPPORT, MIN_VEHICLES, useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSupportCollection, useVehicleCollection } from '@/store/useCollection';
import { useWallet } from '@/store/useWallet';
import { VEHICLE_CLASSES, type Card, type SupportCard, type VehicleClass } from '@/types';

type Filter = 'all' | VehicleClass;
type Segment = 'vehicles' | 'pit';

const CHIPS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  ...VEHICLE_CLASSES.map((c) => ({ key: c as Filter, label: CLASS_LABEL[c] })),
];

/**
 * Saha Ekibi / Pit Ekibi ayrımı SEGMENT olarak duruyor, filtre çipi olarak
 * değil.
 *
 * Bir ara çipler arasına konmuştu ("tek ekran" hissi için) ama iki havuz
 * gerçekten farklı: kartların anatomisi ayrı (araçta stat var, pitte etki
 * metni), kadro sınırları ayrı (en az 3 araç, en fazla 5 pit) ve kategori
 * filtreleri yalnızca araçlara ait. Aynı sırada durmaları, ilgisiz iki şeyi
 * eşitmiş gibi gösteriyordu.
 */
const SEGMENTS: {
  key: Segment;
  label: string;
  icon: 'truck' | 'wrench';
  /** Aktifken dolgu rengi: araçlar mavi, pit mor. Renk havuzun kimliği —
   *  kartların kenarı da aynı rengi kullanıyor. */
  fill: string;
  tint: string;
}[] = [
    { key: 'vehicles', label: 'Saha Ekibi', icon: 'truck', fill: colors.primary, tint: colors.textMuted },
    { key: 'pit', label: 'Pit Ekibi', icon: 'wrench', fill: colors.grape, tint: colors.grapeInk },
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
  const dialog = useDialog();
  const loadout = useGameStore((s) => s.loadout);
  const supportLoadout = useGameStore((s) => s.supportLoadout);
  const toggle = useGameStore((s) => s.toggleLoadout);
  const toggleSupport = useGameStore((s) => s.toggleSupportLoadout);
  const vehicles = useVehicleCollection();
  const support = useSupportCollection();
  const unlock = useSessionStore((s) => s.unlockCard);
  const { rims, coins, fromServer: online } = useWallet();

  const [segment, setSegment] = useState<Segment>('vehicles');
  const [filter, setFilter] = useState<Filter>('all');
  const [inspect, setInspect] = useState<Card | null>(null);
  const [inspectPit, setInspectPit] = useState<SupportCard | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Filtre değişince başa dön: kısa bir listeden uzun bir listeye (ya da
  // tersine) geçildiğinde eski kaydırma konumu artık var olmuyor ve
  // ScrollView kendi başına geçerli bir yere zıplıyor.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [filter, segment]);

  const total = loadout.length + supportLoadout.length;
  const showPit = segment === 'pit';

  const vehicleList = useMemo(() => {
    const list = filter === 'all' ? CARDS : CARDS.filter((c) => c.class === filter);
    return [...list].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [filter, segment]);

  function onVehiclePress(card: Card) {
    // Sahip olunan kart kadroya girer/çıkar; kilitli kart satın alma
    // ekranına götürür. İki farklı sonuç, iki farklı görünüm (bkz. GameCard).
    if (!vehicles.has(card.id)) {
      router.push(`/card/${card.id}`);
      return;
    }
    if (!loadout.includes(card.id) && total >= LOADOUT_TOTAL) {
      dialog.show({
        title: 'Kadro dolu',
        message: `Kadroda ${LOADOUT_TOTAL} kart var. Önce birini çıkar.`,
        actions: [{ label: 'Tamam', variant: 'primary' }],
      });
      return;
    }
    toggle(card.id);
  }

  function onSupportPress(card: SupportCard) {
    if (!support.has(card.id)) {
      void unlockSupport(card, { rims, coins }, online, unlock, dialog.show);
      return;
    }
    const inSquad = supportLoadout.includes(card.id);
    if (!inSquad && supportLoadout.length >= MAX_SUPPORT) {
      dialog.show({
        title: 'Pit Ekibi dolu',
        message: `En fazla ${MAX_SUPPORT} Pit Ekibi kartı taşıyabilirsin.`,
        actions: [{ label: 'Tamam', variant: 'primary' }],
      });
      return;
    }
    if (!inSquad && total >= LOADOUT_TOTAL) {
      dialog.show({
        title: 'Kadro dolu',
        message: `Kadroda ${LOADOUT_TOTAL} kart var. Önce birini çıkar.`,
        actions: [{ label: 'Tamam', variant: 'primary' }],
      });
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
          <Text style={styles.squadLabel}>Kadron</Text>
          <Text style={[styles.squadCount, total !== LOADOUT_TOTAL && styles.squadCountWarn]}>
            {total}/{LOADOUT_TOTAL}
            <Text style={styles.squadDetail}>
              {'  '}· {loadout.length} araç · {supportLoadout.length} pit
            </Text>
          </Text>
        </View>

        {/* Yatay kaydırma: 8 yuva + ayraç 402 px ekrana sığmıyor ve kadro
            sınırı ileride değişebilir. Sabit genişliğe sıkıştırmak yuvaları
            okunmaz hale getirirdi. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.squadStrip}
          style={styles.squadStripOuter}
        >
          {loadout.map((id) => (
            <SquadSlot key={id} cardId={id} onRemove={() => toggle(id)} />
          ))}
          {supportLoadout.length > 0 && <View style={styles.divider} />}
          {supportLoadout.map((id) => (
            <SquadSlot key={id} cardId={id} kind="support" onRemove={() => toggleSupport(id)} />
          ))}
          {Array.from({ length: Math.max(0, LOADOUT_TOTAL - total) }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.segments}>
        {SEGMENTS.map((s) => {
          const on = segment === s.key;
          const count = s.key === 'vehicles' ? loadout.length : supportLoadout.length;
          return (
            <Pressable
              key={s.key}
              style={[styles.segment, on && { backgroundColor: s.fill }]}
              onPress={() => setSegment(s.key)}
            >
              <MaterialCommunityIcons name={s.icon} size={16} color={on ? '#FFFFFF' : s.tint} />
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {s.label} <Text style={styles.segmentCount}>({count})</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Kategori filtreleri yalnızca araçlara ait; pit havuzunda karşılığı yok. */}
      {!showPit && (
        <View style={styles.chips}>
          <CategoryTabs options={CHIPS} value={filter} onChange={setFilter} />
        </View>
      )}

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
                  onLongPress={() => setInspectPit(card)}
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
      </ScrollView>

      {inspect && <CardInspectPanel card={inspect} onClose={() => setInspect(null)} />}
      {/* Pit kartının etki metni ızgarada iki satıra sığmıyor; basılı tutmak
          araç kartlarındaki gibi tamamını açıyor. */}
      {inspectPit && <SupportInspectPanel card={inspectPit} onClose={() => setInspectPit(null)} />}
    </SafeAreaView>
  );
}

/**
 * Pit kartı.
 *
 * Araç kartıyla aynı anatomiye sahip değil ve olmamalı: araçta stat var,
 * pitte etki metni. Yerleşim ikon → ad → etki → güç noktaları şeklinde,
 * yani okuma sırası "ne bu / ne yapar / ne kadar güçlü".
 *
 * Rengi MOR (grape), araçların mavisinden ayrı: iki havuz farklı ve renk
 * bunu kart seviyesinde de söylüyor.
 */
function PitCard({
  card,
  owned,
  inSquad,
  onPress,
  onLongPress,
}: {
  card: SupportCard;
  owned: boolean;
  inSquad: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.pit, inSquad && styles.pitOn, !owned && styles.pitLocked]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={CARD_INSPECT_MS}
    >
      {/* İkon yeteneğin TÜRÜNE bağlı: hepsi aynı anahtar ikonuyken kartlar
          birbirinden yalnızca adlarıyla ayrılıyordu. */}
      {/* İkon iki kat büyük ve ortada: pit kartının nadirlik rengi ya da
          aracı yok, tanınmasını sağlayan tek görsel işaret bu. */}
      <MaterialCommunityIcons name={SUPPORT_ICON[card.kind]} size={44} color={colors.grapeInk} />
      <Text style={styles.pitName} numberOfLines={1}>
        {card.name}
      </Text>
      <Text style={styles.pitEffect} numberOfLines={3}>
        {supportCardEffectText(card)}
      </Text>
      <View style={styles.pitFoot}>
        <PowerStars power={card.power} />
      </View>

      {/* Kilit ve fiyat TEK rozette, araç kartındaki yerin aynısında (sol üst).
          Ayrı durduklarında oyuncu aynı bilgiyi iki yerden topluyordu: köşede
          kilit, altta rakam. */}
      {!owned && (
        <View style={styles.pitLock}>
          <MaterialCommunityIcons name="lock" size={12} color={colors.ink} />
          <CurrencyTag currency="rim" amount={card.price.rim} size={text.bodySmall.fontSize} />
        </View>
      )}

      {inSquad && (
        <View style={styles.pitCheck}>
          <MaterialCommunityIcons name="check-bold" size={12} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Güç seviyesi — pit kartlarında nadirlik yok, onun yerine bu.
 *
 * Yıldız, nokta değil: araç kartlarında nadirlik zaten yıldızla gösteriliyor
 * (`RarityStars`) ve iki havuzun "ne kadar iyi" göstergesi aynı dili
 * konuşmalı. Rengi mor, çünkü pit havuzunun kimliği o.
 */
function PowerStars({ power }: { power: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4].map((i) => (
        <MaterialCommunityIcons
          key={i}
          name={i <= power ? 'star' : 'star-outline'}
          size={14}
          color={i <= power ? colors.grape : colors.border}
        />
      ))}
    </View>
  );
}

/**
 * Pit kartının kilidini açar.
 *
 * Kart detayı ekranı yalnızca araçlar için var; pit kartının ayrı bir sayfası
 * olmadığı için satın alma burada bir diyalogla sorulup sunucuya gidiyor.
 * Gösterilen fiyat bilgi amaçlı — gerçek kontrol ve tahsilat sunucuda tek
 * transaction içinde.
 */
async function unlockSupport(
  card: SupportCard,
  wallet: { rims: number; coins: number },
  online: boolean,
  unlock: (cardId: string, currency: CurrencyCode) => Promise<string | null>,
  show: (options: DialogOptions) => void,
) {
  if (!online) {
    show({
      title: card.name,
      message: 'Kart açmak için internet bağlantısı gerekiyor.',
      actions: [{ label: 'Tamam', variant: 'primary' }],
    });
    return;
  }

  const withRim = card.price.rim > 0 && wallet.rims >= card.price.rim;
  const withCoin = card.price.coin > 0 && wallet.coins >= card.price.coin;
  if (!withRim && !withCoin) {
    show({
      title: card.name,
      message: `Bu kart için ${card.price.rim} jant gerekiyor. Elinde ${wallet.rims} jant var.`,
      actions: [{ label: 'Tamam', variant: 'primary' }],
    });
    return;
  }

  const buy = async (currency: CurrencyCode) => {
    const error = await unlock(card.id, currency);
    if (error) show({ title: card.name, message: error, actions: [{ label: 'Tamam', variant: 'primary' }] });
  };

  show({
    title: card.name,
    message: 'Bu Pit Ekibi kartının kilidini nasıl açalım?',
    actions: [
      ...(withRim
        ? [{ label: `${card.price.rim} jant`, variant: 'primary' as const, onPress: () => void buy('RIM') }]
        : []),
      ...(withCoin ? [{ label: `${card.price.coin} coin`, onPress: () => void buy('COIN') }] : []),
      { label: 'Vazgeç' },
    ],
  });
}

/**
 * Pit kartının tam etkisi.
 *
 * Araç kartının hızlı bilgisi (`CardInspectPanel`) ekranın ORTASINDA açılan
 * bir panel; bu da öyle. Aynı jestin (basılı tut) iki farklı yerden iki
 * farklı şekilde açılması, oyuncuya iki ayrı mekanizma varmış gibi
 * hissettiriyordu.
 */
function SupportInspectPanel({ card, onClose }: { card: SupportCard; onClose: () => void }) {
  return (
    <Pressable style={styles.inspectScrim} onPress={onClose}>
      <Pressable style={styles.inspectPanel} onPress={() => { }}>
        <View style={styles.inspectHero}>
          <MaterialCommunityIcons name={SUPPORT_ICON[card.kind]} size={64} color={colors.grapeInk} />
          <Pressable style={styles.inspectClose} onPress={onClose}>
            <MaterialCommunityIcons name="close-thick" size={15} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.inspectBody}>
          <Text style={styles.inspectName}>{card.name}</Text>
          <View style={styles.inspectMeta}>
            <PowerStars power={card.power} />
            <Text style={styles.inspectPower}>Güç {card.power}</Text>
          </View>

          <Text style={styles.inspectEffect}>{supportCardEffectText(card)}</Text>

          <View style={styles.inspectNote}>
            <MaterialCommunityIcons name="information-outline" size={17} color={colors.accentDark} />
            <Text style={styles.inspectNoteText}>
              Sahaya çıkmaz, yakıt harcamaz — turda en fazla bir tane oynayabilirsin.
            </Text>
          </View>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inspectScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,18,28,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  inspectPanel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.raised,
  },
  inspectHero: {
    height: 130,
    backgroundColor: colors.grapeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectBody: { padding: space.md, gap: 10 },
  inspectName: { fontFamily: font.heading, fontSize: 20, lineHeight: 26, color: colors.ink },
  inspectMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inspectPower: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.grapeInk },
  inspectEffect: {
    fontFamily: font.body,
    fontSize: text.body.fontSize,
    lineHeight: text.body.lineHeight,
    color: colors.ink,
  },
  inspectNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
  },
  inspectNoteText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.ink,
  },

  segments: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16, marginBottom: 8 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.lg,
    backgroundColor: colors.sunken,
  },
  segmentText: { fontFamily: font.bodyBold, fontSize: text.body.fontSize, color: colors.textMuted },
  segmentCount: { fontFamily: font.body, fontSize: text.bodySmall.fontSize },
  segmentTextOn: { color: '#FFFFFF' },

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
    fontSize: text.bodySmall.fontSize,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  squadCount: { fontFamily: font.bodyBlack, fontSize: text.bodySmall.fontSize, color: colors.successInk },
  squadCountWarn: { color: colors.accentDark },
  squadDetail: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.textFaint },
  squadStripOuter: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    ...shadow.card,
  },
  squadStrip: { flexDirection: 'row', gap: 5, padding: 10, alignItems: 'center' },
  slot: { width: 40, height: 54, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
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

  chips: { paddingTop: space.xs, paddingBottom: 0, marginBottom: 0 },
  scroll: { paddingHorizontal: space.md, paddingTop: 12, paddingBottom: NAV_CLEARANCE },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: -9 },
  /** İKİ sütun. Üç sütunda kart 108 px kalıyordu ve içindeki üç stat kutusu
   *  (Güç/Dayanıklılık/Hız) taşıp okunmaz hale geliyordu — kartın taşıdığı
   *  asıl bilgi görünmüyordu. */
  cell: { width: '48.5%', aspectRatio: 0.78 },

  pit: {
    flex: 1,
    gap: 6,
    padding: 11,
    // Altta yıldızlara ayrılan yer: ortalanan içerik onların üstüne binmesin.
    paddingBottom: 30,
    // İçerik iki eksende de ortalı: pit kartında araç görseli gibi alanı
    // dolduran bir öğe yok, o yüzden üste yaslanınca kartın altı boş
    // kalıyordu ve kart yarım görünüyordu.
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    ...shadow.card,
  },
  pitOn: { borderColor: colors.grape, backgroundColor: colors.grapeSoft },
  pitLocked: { opacity: 0.62 },
  /**
   * Yıldızlar kartın DİBİNDE ve ortada — akışın içinde değil.
   *
   * Akışta bırakılınca ortalanan bloğun parçası oluyor ve her kartta farklı
   * bir yükseklikte duruyordu (etki metni bir, iki ya da üç satır olabiliyor),
   * yani ızgarada göz için bir hizaya oturmuyordu. Mutlak konumlanınca bütün
   * kartlarda aynı yerde. Kartın alt dolgusu da onlara yer açıyor.
   */
  pitFoot: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dots: { flexDirection: 'row', gap: 2 },
  pitCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.grape,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitLock: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  pitName: { fontFamily: font.bodyBlack, fontSize: text.bodySmall.fontSize, color: colors.ink, textAlign: 'center' },
  pitEffect: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },

});
