import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { IdentityProvider } from '@/api/types';
import { CurrencyTag } from '@/components/Currency';
import { colors, font, radius, shadow, space, text } from '@/constants/theme';
import { SIGNUP_BONUS_RIM } from '@/game/difficulty';
import { CARDS } from '@/data/cards';
import { useSessionStore } from '@/store/sessionStore';

/**
 * GİRİŞ — misafire ne kazanacağını anlatan ekran.
 *
 * Bir duvar değil bir TEKLİF: "Şimdilik misafir kal" her zaman açık ve
 * utandırıcı değil. Ekran yalnızca yönlendirme hedefi olarak kullanılıyor —
 * 5. maç diyaloğu, kilitli sekmeler, kilitli kart ve Oyna ekranındaki şerit
 * hepsi buraya getiriyor.
 *
 * Vaatler SOMUT: "araç topla" değil "35 aracın hepsi". Belirsiz bir vaat,
 * hiç vaat etmemekten kötü.
 */
const PROMISES: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  bg: string;
  title: string;
  sub: string;
}[] = [
  {
    icon: 'car-sports',
    tint: colors.accentDark,
    bg: colors.accentSoft,
    title: 'Araçlarını topla',
    sub: `${CARDS.length} aracın hepsi açılabilir`,
  },
  {
    icon: 'shopping',
    tint: colors.grapeInk,
    bg: colors.grapeSoft,
    title: 'Paketler aç',
    sub: 'Destansı kart şansı her pakette',
  },
  {
    icon: 'trophy-variant',
    tint: colors.primaryInk,
    bg: colors.primarySoft,
    title: 'Lige katıl',
    sub: 'Sıralamada yüksel · yakında',
  },
  {
    icon: 'account-multiple',
    tint: colors.bubble,
    bg: '#FFE4EE',
    title: 'Arkadaşlarınla oyna',
    sub: 'Meydan oku, rövanş al · yakında',
  },
];

export default function SignInScreen() {
  const router = useRouter();
  const signIn = useSessionStore((s) => s.signInWithProvider);
  const [busy, setBusy] = useState<IdentityProvider | null>(null);

  async function onProvider(provider: IdentityProvider) {
    setBusy(provider);
    const result = await signIn(provider);
    setBusy(null);
    // Vazgeçme hata değil: sağlayıcı ekranını kapatan oyuncuya uyarı
    // göstermek, yaptığı şeyi yanlışmış gibi sunmak olurdu.
    if (result === 'cancelled') return;
    if (result) {
      Alert.alert('Giriş yapılamadı', result);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.closeRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={22} color={colors.textFaint} />
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Garajını{'\n'}kalıcı hale getir</Text>
        <Text style={styles.lead}>
          Misafir olarak oynamaya devam edebilirsin. Ama kartların, jantın ve ilerlemen yalnızca
          giriş yaptığında saklanır.
        </Text>
      </View>

      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p.title} style={styles.promise}>
            <View style={[styles.promiseIcon, { backgroundColor: p.bg }]}>
              <MaterialCommunityIcons name={p.icon} size={24} color={p.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promiseTitle}>{p.title}</Text>
              <Text style={styles.promiseSub}>{p.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* Hediye düğmelerin hemen üstünde: dokunmanın karşılığı görünür olmalı. */}
      <View style={styles.giftWrap}>
        <View style={styles.gift}>
          <CurrencyTag currency="rim" amount={SIGNUP_BONUS_RIM} size={15} color={colors.primaryInk} />
          <Text style={styles.giftText}>hoş geldin hediyesi</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {/* Apple üstte: iOS'ta üçüncü taraf girişi sunan uygulamanın Apple ile
            Giriş'i de sunması App Store kuralı ve platformun kendi yolu önce
            gelmeli. */}
        <Pressable style={styles.appleBase} onPress={() => void onProvider('APPLE')} disabled={busy !== null}>
          <View style={styles.appleFace}>
            {busy === 'APPLE' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleText}>Apple ile devam et</Text>
              </>
            )}
          </View>
        </Pressable>

        <Pressable style={styles.googleBase} onPress={() => void onProvider('GOOGLE')} disabled={busy !== null}>
          <View style={styles.googleFace}>
            {busy === 'GOOGLE' ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
                <Text style={styles.googleText}>Google ile devam et</Text>
              </>
            )}
          </View>
        </Pressable>

        <Pressable style={styles.skip} onPress={() => router.back()}>
          <Text style={styles.skipText}>Şimdilik misafir kal</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: space.md, paddingTop: 14 },
  intro: { paddingHorizontal: space.lg, paddingTop: space.lg },
  title: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: colors.ink },
  lead: {
    marginTop: 8,
    fontFamily: font.body,
    fontSize: text.body.fontSize,
    lineHeight: 20,
    color: colors.textMuted,
  },
  promises: { gap: 10, paddingHorizontal: space.lg, paddingTop: 22 },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    ...shadow.card,
  },
  promiseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  promiseTitle: { fontFamily: font.headingSm, fontSize: 15, lineHeight: 19, color: colors.ink },
  promiseSub: { fontFamily: font.body, fontSize: text.small.fontSize, color: colors.textMuted },

  giftWrap: { paddingHorizontal: space.lg },
  gift: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  giftText: { fontFamily: font.bodyBlack, fontSize: text.body.fontSize, color: colors.primaryInk },

  actions: { gap: 10, paddingHorizontal: space.lg, paddingTop: 14, paddingBottom: space.lg },
  appleBase: { backgroundColor: '#000000', borderRadius: radius.pill },
  appleFace: {
    height: 54,
    marginBottom: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  appleText: { fontFamily: font.bodyBlack, fontSize: text.bodyLg.fontSize, color: '#FFFFFF' },
  googleBase: { backgroundColor: colors.borderStrong, borderRadius: radius.pill },
  googleFace: {
    height: 54,
    marginBottom: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  googleText: { fontFamily: font.bodyBlack, fontSize: text.bodyLg.fontSize, color: colors.ink },
  skip: { height: 40, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: font.bodyBold, fontSize: text.body.fontSize, color: colors.textMuted },
});
