import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { newRequestId } from '@/api/requestId';
import type { PackOpenResult } from '@/api/types';
import { ChunkyButton } from '@/components/ChunkyButton';
import { CurrencyTag } from '@/components/Currency';
import { colors, font, radius, rarity as rarityTheme, shadow, space, text } from '@/constants/theme';
import { playSfx } from '@/audio/sfx';
import { getCard } from '@/data/cards';
import { carImage } from '@/data/carImages';
import { useSessionStore } from '@/store/sessionStore';

type Phase = 'ready' | 'opening' | 'result';

/**
 * Paket açma akışı — üç adım tek ekranda: kapalı kart, açılış, sonuç.
 *
 * Alt gezinme YOK (bu yüzden `(main)` grubunun dışında, savaş ekranı gibi):
 * akış başlayınca oyuncunun tek yapması gereken şey kartı görmek.
 */
export default function PackOpeningScreen() {
  const router = useRouter();
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const openPack = useSessionStore((s) => s.openPack);
  const rims = useSessionStore((s) => s.rims);

  const [phase, setPhase] = useState<Phase>('ready');
  const [result, setResult] = useState<PackOpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Tekrar koruması kimliği bir KEZ üretiliyor ve açılış boyunca aynı kalıyor.
   *
   * Her denemede yenisini üretmek korumayı işlevsiz kılardı: sunucu aynı
   * kimliği görmediği sürece her isteği yeni bir açılış sayar ve oyuncudan
   * ikinci kez para düşer. `useRef` ekran yeniden render olsa da değeri
   * koruyor.
   */
  const requestId = useRef(newRequestId());

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.03, { duration: 1200 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const open = useCallback(async () => {
    if (phase !== 'ready') return;
    setPhase('opening');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const res = await openPack(packId, requestId.current);
    if ('error' in res) {
      setError(res.error);
      setPhase('ready');
      return;
    }
    setResult(res);
    setPhase('result');
    playSfx(res.duplicate ? 'pop' : 'win', res.duplicate ? 0.6 : 0.8);
    Haptics.notificationAsync(
      res.duplicate ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  }, [openPack, packId, phase]);

  if (phase === 'result' && result) {
    return <ResultView result={result} rims={rims} onDone={() => router.replace('/store')} />;
  }

  return (
    <View style={styles.dark}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        {/* Açılış sürerken kapatılamıyor: istek yolda kaldıysa oyuncu parası
            düşmüş ama sonucu görülmemiş bir paket bırakırdı. Kart yine de
            koleksiyona yazılır ama oyuncu ne çıktığını göremez. */}
        <Pressable
          style={[styles.closeRow, phase === 'opening' && styles.closeDisabled]}
          onPress={() => phase !== 'opening' && router.replace('/store')}
          disabled={phase === 'opening'}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <View style={styles.center}>
          <Pressable onPress={open} disabled={phase === 'opening'}>
            <Animated.View style={[styles.back, pulseStyle]}>
              {phase === 'opening' ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <View style={styles.backInner}>
                  <MaterialCommunityIcons name="tire" size={62} color="#FFFFFF" />
                  <Text style={styles.backWord}>CARDRAFT</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>

          <Text style={styles.hint}>
            {phase === 'opening' ? 'Açılıyor…' : 'Açmak için karta dokun'}
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={17} color={colors.warning} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        <View style={styles.balancePill}>
          <CurrencyTag currency="rim" amount={rims} size={14} color="#FFFFFF" />
          <Text style={styles.balanceText}>jant</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ResultView({
  result,
  rims,
  onDone,
}: {
  result: PackOpenResult;
  rims: number;
  onDone: () => void;
}) {
  const card = getCard(result.card.cardId);
  const tint = rarityTheme[card.rarity];

  return (
    <SafeAreaView style={styles.lightFill} edges={['top', 'bottom']}>
      <View style={styles.resultBody}>
        <View style={styles.resultHead}>
          <View style={[styles.badge, { backgroundColor: result.duplicate ? colors.sunken : colors.bubble }]}>
            <Text style={[styles.badgeText, { color: result.duplicate ? colors.textMuted : colors.ink }]}>
              {result.duplicate ? 'ZATEN SENDE' : 'YENİ KART'}
            </Text>
          </View>
          <Text style={styles.resultTitle}>
            {result.duplicate ? 'Jant olarak geri döndü' : 'Garajına katıldı!'}
          </Text>
        </View>

        {/* Tekrar kart soluk gösteriliyor: kazanım değil, dürüst bir sonuç. */}
        <View style={[styles.card, { borderColor: tint.border }, result.duplicate && styles.cardFaded]}>
          <View style={[styles.cardArt, { backgroundColor: tint.art }]}>
            <Image source={carImage(card.id)} style={styles.cardImg} resizeMode="cover" />
            <View style={styles.costBadge}>
              <MaterialCommunityIcons name="lightning-bolt" size={12} color={colors.accent} />
              <Text style={styles.costText}>{card.cost}</Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName}>{card.name}</Text>
            <View style={styles.rarityRow}>
              {Array.from({ length: tint.stars }).map((_, i) => (
                <MaterialCommunityIcons key={i} name="star" size={13} color={tint.border} />
              ))}
              <Text style={[styles.rarityText, { color: tint.ink }]}>{tint.label.toUpperCase()}</Text>
            </View>
            {!result.duplicate && (
              <View style={styles.stats}>
                <Stat label="Güç" value={card.attack} color={colors.dangerInk} />
                <Stat label="Dayanıklılık" value={card.health} color={colors.successInk} />
                <Stat label="Hız" value={card.speed} color={colors.primaryInk} />
              </View>
            )}
          </View>
        </View>

        {result.duplicate ? (
          <View style={styles.refundBox}>
            <View style={styles.refundAmount}>
              <MaterialCommunityIcons name="tire" size={26} color={colors.successInk} />
              <Text style={styles.refundNumber}>+{result.refund}</Text>
            </View>
            <Text style={styles.refundNote}>{card.price.rim} jant değerinin %25&apos;i</Text>
          </View>
        ) : (
          <View style={styles.abilityBox}>
            <MaterialCommunityIcons name="flash-outline" size={17} color={colors.grapeInk} />
            <Text style={styles.abilityText}>{card.flavor}</Text>
          </View>
        )}

        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Yeni bakiyen</Text>
          <CurrencyTag currency="rim" amount={rims} size={17} />
        </View>
      </View>

      <View style={styles.actions}>
        <ChunkyButton variant="primary" label="Mağazaya dön" onPress={onDone} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dark: { flex: 1, backgroundColor: colors.ink },
  closeRow: { alignSelf: 'flex-end', padding: space.md },
  closeDisabled: { opacity: 0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 30 },
  back: {
    width: 196,
    height: 268,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  backInner: {
    width: 152,
    height: 224,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  backWord: { fontFamily: font.heading, fontSize: 17, color: '#FFFFFF', letterSpacing: 0.5 },
  hint: { fontFamily: font.bodyBold, fontSize: text.body.fontSize, color: 'rgba(255,255,255,0.72)' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: space.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  errorText: { flex: 1, fontFamily: font.body, fontSize: text.small.fontSize, color: '#FFFFFF' },
  balancePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space.lg,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  balanceText: { fontFamily: font.body, fontSize: text.body.fontSize, color: 'rgba(255,255,255,0.6)' },

  lightFill: { flex: 1, backgroundColor: colors.bg },
  resultBody: { flex: 1, alignItems: 'center', paddingHorizontal: space.md, paddingTop: 40 },
  resultHead: { alignItems: 'center', gap: 5 },
  badge: { paddingHorizontal: 13, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontFamily: font.bodyBlack, fontSize: text.caption.fontSize, letterSpacing: 0.6 },
  resultTitle: { fontFamily: font.heading, fontSize: 26, lineHeight: 32, color: colors.ink },

  card: {
    marginTop: 22,
    width: 214,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.raised,
  },
  cardFaded: { opacity: 0.72 },
  cardArt: { height: 152, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  costBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  costText: { fontFamily: font.stat, fontSize: 13, color: colors.ink },
  cardBody: { padding: 12, gap: 9 },
  cardName: { fontFamily: font.headingSm, fontSize: 19, lineHeight: 23, color: colors.ink },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rarityText: { fontFamily: font.bodyBold, fontSize: text.caption.fontSize, letterSpacing: 0.5 },
  stats: { flexDirection: 'row', gap: 5 },
  stat: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.sunken, alignItems: 'center' },
  statValue: { fontFamily: font.stat, fontSize: 17, lineHeight: 20 },
  statLabel: { fontFamily: font.bodyBold, fontSize: text.micro.fontSize, color: colors.textMuted },

  refundBox: {
    marginTop: 24,
    width: '100%',
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  refundAmount: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  refundNumber: { fontFamily: font.stat, fontSize: 34, lineHeight: 38, color: colors.successInk },
  refundNote: { fontFamily: font.bodyBold, fontSize: text.small.fontSize, color: colors.textMuted },

  abilityBox: {
    marginTop: space.md,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  abilityText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: text.small.fontSize,
    lineHeight: text.small.lineHeight,
    color: colors.inkSoft,
  },

  balanceRow: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.sunken,
    borderRadius: radius.md,
  },
  balanceLabel: { fontFamily: font.bodyBold, fontSize: text.small.fontSize, color: colors.inkSoft },

  actions: { padding: space.md, paddingBottom: space.lg },
});
