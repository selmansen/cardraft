import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChunkyButton } from '@/components/ChunkyButton';
import { useDialog } from '@/components/overlay/DialogProvider';
import { CURRENCY, CurrencyTag, WalletPill } from '@/components/Currency';
import { RarityStars } from '@/components/GameCard';
import { colors, font, NAV_CLEARANCE, radius, rarity as RAR, shadow, space, text } from '@/constants/theme';
import { CLASS_LABEL, getCard } from '@/data/cards';
import { carImage } from '@/data/carImages';
import { abilityShort, abilityText } from '@/game/abilities';
import { LOADOUT_TOTAL, useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useVehicleCollection } from '@/store/useCollection';
import { useWallet } from '@/store/useWallet';
import type { CurrencyCode } from '@/api/types';
import type { Currency } from '@/types';

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dialog = useDialog();
  const card = getCard(id);
  const r = RAR[card.rarity];

  const collection = useVehicleCollection();
  const owned = collection.has(card.id);
  const { rims, coins } = useWallet();
  const online = useSessionStore((s) => s.connection) === 'online';
  const unlock = useSessionStore((s) => s.unlockCard);
  const inLoadout = useGameStore((s) => s.loadout.includes(card.id));
  // "Full" means the shared 8-card budget (vehicles + Pit Ekibi) is used up,
  // not that vehicles alone hit some fixed count.
  const loadoutFull = useGameStore((s) => s.loadout.length + s.supportLoadout.length >= LOADOUT_TOTAL);
  const toggleLoadout = useGameStore((s) => s.toggleLoadout);



  const buzz = () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

  /**
   * Kilidi SUNUCU açıyor: istemci fiyat göndermiyor, sadece hangi kart ve
   * hangi kese. Ekrandaki fiyat bilgi amaçlı — gerçek kontrol ve tahsilat
   * sunucuda tek transaction içinde.
   */
  const buy = async (currency: CurrencyCode) => {
    const error = await unlock(card.id, currency);
    if (error) dialog.show({ title: card.name, message: error, actions: [{ label: 'Tamam', variant: 'primary' }] });
    else buzz();
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.crumbRow}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textMuted} />
            <Text style={styles.backText}>Koleksiyon</Text>
          </Pressable>
          <WalletPill rims={rims} coins={coins} />
        </View>

        <View style={[styles.hero, { backgroundColor: r.art }, !owned && styles.dim]}>
          <Image source={carImage(card.id)} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>{owned ? 'SAHİPSİN' : 'KİLİTLİ'}</Text>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.name}>{card.name}</Text>
          <Text style={styles.flavor}>“{card.flavor}”</Text>
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: r.pill }]}>
              <RarityStars count={r.stars} color={r.border} size={12} />
              <Text style={[styles.pillText, { color: r.ink }]}>{r.label.toUpperCase()}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.sunken }]}>
              <MaterialCommunityIcons name="car-sports" size={13} color={colors.inkSoft} />
              <Text style={[styles.pillText, { color: colors.inkSoft }]}>
                {CLASS_LABEL[card.class].toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          <StatBox icon="lightning-bolt" tint={colors.accent} label="GÜÇ" value={card.attack} />
          <StatBox icon="chevron-double-right" tint={colors.primary} label="HIZ" value={card.speed} />
          <StatBox icon="shield" tint={colors.success} label="DAYANIKLILIK" value={card.health} />
          <StatBox icon="water" tint={colors.primaryInk} label="YAKIT" value={card.cost} />
        </View>

        {card.abilities.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.sectionLabel}>ÖZELLİKLER</Text>
            <View style={styles.abilityBox}>
              {card.abilities.map((a, i) => {
                const full = abilityText(a);
                const desc = full.includes(': ') ? full.split(': ')[1] : full;
                return (
                  <View
                    key={i}
                    style={[styles.abilityRow, i < card.abilities.length - 1 && styles.abilityDivider]}
                  >
                    <View style={styles.abilityDot} />
                    <Text style={styles.abilityText}>
                      <Text style={styles.abilityLabel}>{abilityShort(a)} </Text>
                      {desc}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={styles.noAbility}>Özel yeteneği yok. Saf güç.</Text>
        )}

        {owned ? (
          // Yükseltme kaldırıldı: kartlar artık sabit güçte (bkz. cards.ts).
          // Sahip olunan bir kartta yapılabilecek tek şey kadroya almak.
          <ChunkyButton
            variant="secondary"
            disabled={!inLoadout && loadoutFull}
            label={
              inLoadout
                ? '− KADRODAN ÇIKAR'
                : loadoutFull
                  ? `KADRO DOLU (${LOADOUT_TOTAL}/${LOADOUT_TOTAL})`
                  : '+ KADROYA EKLE'
            }
            onPress={() => toggleLoadout(card.id)}
          />
        ) : (
          // İki ayrı buton, tek "satın al" akışı yerine: oyuncu hangi keseden
          // ödediğini görerek seçsin. Jant üstte çünkü varsayılan yol o —
          // coin yalnızca beklemek istemeyenin kısayolu.
          <View style={{ gap: 8 }}>
            <UnlockButton
              currency="rim"
              amount={card.price.rim}
              enabled={online && rims >= card.price.rim}
              have={rims}
              onPress={() => void buy('RIM')}
            />
            <UnlockButton
              currency="coin"
              amount={card.price.coin}
              enabled={online && coins >= card.price.coin}
              have={coins}
              onPress={() => void buy('COIN')}
            />
            {!online ? (
              <Text style={styles.needHint}>Kart açmak için internet bağlantısı gerekiyor</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Tek bir para biriminden kilit açma butonu. Yetmeyen bakiye butonu pasif
 * yapıp altına eksik bilgisini yazıyor — butonu gizlemek yerine göstermek,
 * oyuncuya hedefi ("ne kadar daha") gösteriyor.
 */
function UnlockButton({
  currency,
  amount,
  enabled,
  have,
  onPress,
}: {
  currency: Currency;
  amount: number;
  enabled: boolean;
  have: number;
  onPress: () => void;
}) {
  const c = CURRENCY[currency];
  return (
    <>
      <ChunkyButton variant={currency === 'rim' ? 'primary' : 'accent'} disabled={!enabled} onPress={onPress}>
        <View style={styles.upgradeInner}>
          <Text style={styles.upgradeText}>KİLİDİ AÇ</Text>
          <View style={styles.costChip}>
            <CurrencyTag currency={currency} amount={amount} size={13} color="#FFFFFF" />
          </View>
        </View>
      </ChunkyButton>
      {!enabled ? (
        <Text style={styles.needHint}>
          {amount - have} {c.label.toLocaleLowerCase('tr')} daha gerekli
        </Text>
      ) : null}
    </>
  );
}

function StatBox({
  icon,
  tint,
  label,
  value,
  delta = 0,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  label: string;
  value: number;
  delta?: number;
}) {
  return (
    <View style={styles.statBox}>
      <MaterialCommunityIcons name={icon} size={15} color={tint} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={styles.statValue}>{value}</Text>
        {delta > 0 ? <Text style={styles.statDelta}>+{delta}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 14, paddingBottom: NAV_CLEARANCE + space.lg },
  crumbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: font.bodyBold, fontSize: 14, color: colors.textMuted },
  hero: { height: 190, borderRadius: radius.xl, overflow: 'hidden', position: 'relative' },
  dim: { opacity: 0.6 },
  heroImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  levelPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  levelPillText: { fontFamily: font.stat, fontSize: 14, color: colors.ink },
  name: { fontFamily: font.display, fontSize: 26, color: colors.ink },
  flavor: { fontFamily: font.body, fontSize: 14, lineHeight: 20, fontStyle: 'italic', color: colors.textMuted },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  pillText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, letterSpacing: 0.5 },
  statRow: { flexDirection: 'row', gap: 7 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: colors.sunken,
    borderRadius: 14,
  },
  statValue: { fontFamily: font.stat, fontSize: 18, color: colors.ink },
  statDelta: { fontFamily: font.stat, fontSize: text.bodySmall.fontSize, color: colors.successInk },
  statLabel: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.textFaint, textAlign: 'center' },
  sectionLabel: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, letterSpacing: 1, color: colors.textFaint },
  abilityBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  abilityRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14 },
  abilityDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  abilityDot: { width: 7, height: 7, marginTop: 5, borderRadius: 4, backgroundColor: colors.accent },
  abilityText: { flex: 1, fontFamily: font.body, fontSize: text.bodySmall.fontSize, lineHeight: text.bodySmall.lineHeight, color: colors.inkSoft },
  abilityLabel: { fontFamily: font.bodyBold, color: colors.ink },
  noAbility: { fontFamily: font.body, fontSize: text.bodySmall.fontSize, color: colors.textFaint, textAlign: 'center' },
  upgradeInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  upgradeText: { fontFamily: font.display, fontSize: 14, color: '#FFFFFF' },
  costChip: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  costChipText: { fontFamily: font.stat, fontSize: 14, color: '#FFFFFF' },
  needHint: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.textMuted, textAlign: 'center', marginTop: -2 },
});
