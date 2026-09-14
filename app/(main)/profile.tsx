import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authApi, statsApi } from '@/api/endpoints';
import type { PlayerStats } from '@/api/types';
import { colors, font, NAV_CLEARANCE, radius, shadow, space, text } from '@/constants/theme';
import { getProviderCredential } from '@/auth/providerSignIn';
import { useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';

/**
 * PROFİL — hesap, istatistik, ayarlar.
 *
 * Menüden buraya taşınanlar: "Nasıl Oynanır" ve ses/otomatik tur ayarları.
 * Menü onlardan kurtuldu, Profil de boş bir ekran olmaktan kurtuldu.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const soundOn = useGameStore((s) => s.soundOn);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const autoEndTurn = useGameStore((s) => s.autoEndTurn);
  const toggleAutoEndTurn = useGameStore((s) => s.toggleAutoEndTurn);
  const localPlayed = useGameStore((s) => s.battlesPlayed);
  const localWon = useGameStore((s) => s.battlesWon);

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const isGuest = user?.isGuest ?? true;

  /**
   * İstatistikler SUNUCUDAN. Yerel sayaçlar yalnızca çevrimdışı oynanan
   * maçları biliyor; bağlı bir oyuncuya onları göstermek yanlış rakam
   * söylemek olurdu. Misafirde sunucu da 0 döndüğü için yerel sayaç
   * gösteriliyor — orada tek doğru kaynak o.
   */
  useFocusEffect(
    useCallback(() => {
      if (isGuest) return;
      statsApi
        .me()
        .then(setStats)
        .catch(() => setStats(null));
    }, [isGuest]),
  );

  const played = isGuest ? localPlayed : stats?.battlesPlayed ?? 0;
  const won = isGuest ? localWon : stats?.battlesWon ?? 0;
  const best = stats?.bestWinStreak ?? 0;

  function onSignOut() {
    Alert.alert('Çıkış yap', 'Tekrar giriş yaptığında ilerlemen olduğu gibi duruyor olacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => void signOut().then(() => router.replace('/')) },
    ]);
  }

  /**
   * Hesabı siler.
   *
   * Apple App Store, hesap açmaya izin veren uygulamanın silmeye de izin
   * vermesini şart koşuyor (5.1.1(v)) — bu satır bir yayın şartı.
   *
   * Bağlı hesapta sunucu sağlayıcıdan TAZE bir jeton istiyor: silme geri
   * alınamaz ve access token 15 dakika yaşıyor, telefonu kısa süreliğine
   * eline geçiren biri hesabı silememeli.
   */
  function onDelete() {
    Alert.alert(
      'Hesabı sil',
      'Kartların, jantın ve bütün ilerlemen kalıcı olarak silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Hesabı sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                /**
                 * Bağlı hesapta sunucu sağlayıcıdan taze jeton istiyor;
                 * hangi sağlayıcı olduğunu `/auth/me` söylüyor. Tahmin
                 * etmek, iki sağlayıcıdan birini bağlamış oyuncuda yanlış
                 * ekranı açmak olurdu.
                 */
                const provider = user?.providers?.[0];
                const confirmation =
                  isGuest || !provider ? undefined : await getProviderCredential(provider);
                await authApi.deleteAccount(confirmation);
                await signOut();
                router.replace('/');
              } catch (error) {
                Alert.alert('Hesap silinemedi', (error as Error).message);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <Text style={styles.title}>Profil</Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hesap durumu en üstte: "kimim ve verim güvende mi" sorusu. */}
        <View style={styles.accountCard}>
          <View style={[styles.avatar, isGuest && styles.avatarGuest]}>
            <MaterialCommunityIcons
              name="account"
              size={24}
              color={isGuest ? colors.textFaint : colors.primaryInk}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{isGuest ? 'Misafir' : user?.displayName ?? 'Sürücü'}</Text>
            <Text style={[styles.accountSub, !isGuest && styles.accountSubOk]}>
              {isGuest ? 'İlerlemen bu cihaza bağlı' : 'Hesabına bağlı'}
            </Text>
          </View>
          {isGuest ? (
            <Pressable style={styles.linkPill} onPress={() => router.push('/sign-in')}>
              <Text style={styles.linkPillText}>Giriş yap</Text>
            </Pressable>
          ) : (
            <View style={styles.safePill}>
              <Text style={styles.safePillText}>GÜVENDE</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <Stat value={played} label="Maç" />
          <Stat value={won} label="Galibiyet" color={colors.successInk} />
          <Stat value={best} label="En iyi seri" color={colors.accentDark} />
        </View>

        <View style={styles.group}>
          <Row icon="help-circle-outline" label="Nasıl oynanır?" onPress={() => router.push('/how-to-play')} />
          <Row icon="volume-high" label="Ses">
            <Switch value={soundOn} onValueChange={toggleSound} />
          </Row>
          <Row icon="fast-forward" label="Turu otomatik bitir" last>
            <Switch value={autoEndTurn} onValueChange={toggleAutoEndTurn} />
          </Row>
        </View>

        {/* Tehlikeli işlemler ayrı blokta ve en altta. */}
        <View style={styles.group}>
          {!isGuest && <Row icon="logout" label="Çıkış yap" onPress={onSignOut} />}
          <Row icon="trash-can-outline" label="Hesabı sil" danger last onPress={onDelete} />
        </View>

        <Text style={styles.version}>CarDraft 0.2.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  children,
  danger,
  last,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress?: () => void;
  children?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.row, !last && styles.rowDivider]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.dangerInk : colors.textMuted} />
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {children ?? (onPress && !danger ? (
        <MaterialCommunityIcons name="chevron-right" size={17} color={colors.textFaint} />
      ) : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontFamily: font.heading,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  scroll: { padding: space.md, paddingBottom: NAV_CLEARANCE, gap: 12 },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGuest: { backgroundColor: colors.sunken },
  accountName: { fontFamily: font.headingSm, fontSize: 17, lineHeight: 21, color: colors.ink },
  accountSub: { fontFamily: font.bodyBold, fontSize: text.small.fontSize, color: colors.textMuted },
  accountSubOk: { color: colors.successInk },
  linkPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  linkPillText: { fontFamily: font.bodyBlack, fontSize: text.small.fontSize, color: colors.primaryInk },
  safePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.sunken },
  safePillText: {
    fontFamily: font.bodyBlack,
    fontSize: text.micro.fontSize,
    letterSpacing: 0.3,
    color: colors.successInk,
  },

  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  statValue: { fontFamily: font.stat, fontSize: 22, lineHeight: 26, color: colors.ink },
  statLabel: { fontFamily: font.bodyBold, fontSize: text.micro.fontSize, color: colors.textMuted },

  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: text.bodyLg.fontSize, color: colors.ink },
  rowLabelDanger: { color: colors.dangerInk },
  version: {
    fontFamily: font.body,
    fontSize: text.caption.fontSize,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
