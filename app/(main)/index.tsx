import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChunkyButton } from '@/components/ChunkyButton';
import { WalletPill } from '@/components/Currency';
import { colors, font, NAV_CLEARANCE, radius, shadow, space, text } from '@/constants/theme';
import { STARTER_CARD_IDS } from '@/data/cards';
import { DIFFICULTY } from '@/game/difficulty';
import { LOADOUT_TOTAL, useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useVehicleCollection } from '@/store/useCollection';

/** Module scope on purpose: the bottom nav navigates with replace(), so this
 *  screen unmounts and remounts often. A ref would reset with it and could
 *  push a second copy of the tutorial onto the stack. */
let tutorialAutoOpened = false;

export default function MenuScreen() {
  const router = useRouter();
  // Bakiye SUNUCUDAN. Yerel gameStore'daki alanlar çevrimdışı yedek olarak
  // duruyor ama gösterimde sunucu kazanıyor: doğruluk kaynağı orası
  // (ADR 0006/0008) ve iki sayının farklı görünmesi kullanıcıyı yanıltırdı.
  const connection = useSessionStore((s) => s.connection);
  const serverRims = useSessionStore((s) => s.rims);
  const serverCoins = useSessionStore((s) => s.coins);
  const localRims = useGameStore((s) => s.rims);
  const localCoins = useGameStore((s) => s.coins);
  const online = connection === 'online';
  const rims = online ? serverRims : localRims;
  const coins = online ? serverCoins : localCoins;
  const won = useGameStore((s) => s.battlesWon);
  const played = useGameStore((s) => s.battlesPlayed);
  const squadCount = useGameStore((s) => s.loadout.length);
  const pitCount = useGameStore((s) => s.supportLoadout.length);
  const ownedCount = useVehicleCollection().count;
  const difficulty = useGameStore((s) => s.difficulty);
  const howToPlaySeen = useGameStore((s) => s.howToPlaySeen);

  /**
   * Menüye her dönüşte cüzdan ve koleksiyon tazeleniyor.
   *
   * Gerekli çünkü ikisi de BAŞKA YERDE değişiyor: maç ödülünü sunucu yazıyor
   * (savaş ekranı), kart açma da sunucuda. Sadece açılışta okusaydık, oyuncu
   * maçtan döndüğünde eski bakiyeyi görürdü.
   */
  const refreshWallet = useSessionStore((s) => s.refreshWallet);
  const refreshInventory = useSessionStore((s) => s.refreshInventory);
  useFocusEffect(
    useCallback(() => {
      void refreshWallet();
      void refreshInventory();
    }, [refreshWallet, refreshInventory]),
  );

  useEffect(() => {
    if (howToPlaySeen || tutorialAutoOpened) return;
    tutorialAutoOpened = true;
    router.push('/how-to-play');
  }, [howToPlaySeen, router]);

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ gap: 2 }}>
            <Text style={styles.title}>Car Draft</Text>
            <Text style={styles.sub}>
              {played > 0 ? `${won} galibiyet · ${played} maç` : 'İlk yarışını bekliyoruz!'}
            </Text>
            {online ? null : (
              <View style={styles.offlineRow}>
                <MaterialCommunityIcons name="wifi-off" size={11} color={colors.textFaint} />
                <Text style={styles.offlineText}>Çevrimdışı</Text>
              </View>
            )}
          </View>
          <WalletPill rims={rims} coins={coins} />
        </View>

        <ChunkyButton variant="primary" height={70} onPress={() => router.push('/difficulty')}>
          <View style={styles.primaryInner}>
            <View style={{ gap: 3 }}>
              <Text style={styles.primaryTitle}>Savaşa Başla</Text>
              <Text style={styles.primarySub}>Zorluk: {DIFFICULTY[difficulty].label}</Text>
            </View>
            <View style={styles.playCircle}>
              <MaterialCommunityIcons name="play" size={16} color="#FFFFFF" />
            </View>
          </View>
        </ChunkyButton>

        <MenuRow
          title="Kadronu Düzenle"
          sub={`${squadCount + pitCount}/${LOADOUT_TOTAL} kart seçili`}
          onPress={() => router.push('/squad')}
        />
        <MenuRow
          title="Koleksiyon"
          sub={`Garajında ${ownedCount} / 35 araç var`}
          onPress={() => router.push('/collection')}
        />
        <MenuRow
          title="Mağaza"
          sub="Paket aç, koleksiyonunu büyüt"
          onPress={() => router.push('/store')}
        />
        <MenuRow
          title="Nasıl Oynanır?"
          sub="Kuralları öğren, ustalaş!"
          onPress={() => router.push('/how-to-play')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ gap: 2, flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <View style={styles.chevron}>
        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingTop: space.lg, gap: space.md, paddingBottom: NAV_CLEARANCE + space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  title: { fontFamily: font.display, fontSize: 26, color: colors.ink },
  sub: { fontFamily: font.bodyBold, fontSize: text.caption.fontSize, color: colors.textMuted },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  offlineText: { fontFamily: font.bodyBold, fontSize: text.micro.fontSize, color: colors.textFaint },
  primaryInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  primaryTitle: { fontFamily: font.display, fontSize: 19, color: '#FFFFFF' },
  primarySub: { fontFamily: font.body, fontSize: text.small.fontSize, color: colors.primarySoft },
  playCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  rowTitle: { fontFamily: font.bodyBold, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: font.body, fontSize: text.small.fontSize, color: colors.textMuted },
  chevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
