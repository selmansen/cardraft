import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, text } from '@/constants/theme';
import { useSessionStore } from '@/store/sessionStore';

/**
 * Alt gezinme — oyunun ana iskeleti.
 *
 * Beş yuva ve ortadaki OYNA düğmesi oyunun kendisi: uygulama orada açılıyor,
 * yani "ana ekran" ile "oyna" ayrı iki sekme değil. Eskiden bir "Menü"
 * sekmesi vardı ve içi başka sekmelere giden satırlardan ibaretti — bir ara
 * katman.
 *
 * Sekme listesi ŞİMDİDEN tam: Lig henüz yok ama yeri ayrıldı. Sonradan
 * eklenirse bütün menü yeniden düzenlenir ve oyuncunun kas hafızası bozulur.
 */
type Key = 'garage' | 'store' | 'play' | 'league' | 'profile';

interface Tab {
  key: Key;
  label: string;
  href: Href;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Bağlı hesap ister mi? Misafirde kilitli görünür. */
  needsAccount?: boolean;
  /** Henüz yok — "yakında" olarak duruyor. */
  soon?: boolean;
}

const LEFT: Tab[] = [
  { key: 'garage', label: 'Garaj', href: '/garage', icon: 'garage-variant' },
  { key: 'store', label: 'Mağaza', href: '/store', icon: 'shopping', needsAccount: true },
];
const RIGHT: Tab[] = [
  { key: 'league', label: 'Lig', href: '/league', icon: 'trophy-variant', needsAccount: true, soon: true },
  { key: 'profile', label: 'Profil', href: '/profile', icon: 'account' },
];

function activeKey(pathname: string): Key {
  if (pathname.startsWith('/garage') || pathname.startsWith('/card')) return 'garage';
  if (pathname.startsWith('/store')) return 'store';
  if (pathname.startsWith('/league')) return 'league';
  if (pathname.startsWith('/profile') || pathname.startsWith('/how-to-play')) return 'profile';
  return 'play';
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const active = activeKey(pathname);
  const isGuest = useSessionStore((s) => s.user?.isGuest ?? true);

  function go(tab: Tab) {
    // Kilitli sekme GİZLENMİYOR, giriş ekranına götürüyor: oyuncu neyi
    // kaçırdığını görmeli. Gizlemek, olmayan bir oyun gösterirdi.
    if (tab.needsAccount && isGuest) {
      router.push('/sign-in');
      return;
    }
    if (active !== tab.key) router.replace(tab.href);
  }

  return (
    <View style={styles.bar}>
      {LEFT.map((tab) => (
        <TabButton key={tab.key} tab={tab} active={active === tab.key} locked={!!tab.needsAccount && isGuest} onPress={() => go(tab)} />
      ))}

      <View style={styles.centerGap} />

      {RIGHT.map((tab) => (
        <TabButton key={tab.key} tab={tab} active={active === tab.key} locked={!!tab.needsAccount && isGuest} onPress={() => go(tab)} />
      ))}

      {/* Merkez: oyunun kendisi. */}
      <Pressable
        style={styles.center}
        onPress={() => {
          if (active !== 'play') router.replace('/');
        }}
      >
        <View style={styles.playBase}>
          <View style={styles.playFace}>
            <MaterialCommunityIcons name="play" size={26} color="#FFFFFF" />
          </View>
        </View>
        <Text style={[styles.label, active === 'play' ? styles.labelPlayOn : styles.labelOff]}>OYNA</Text>
      </Pressable>
    </View>
  );
}

function TabButton({
  tab,
  active,
  locked,
  onPress,
}: {
  tab: Tab;
  active: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const tint = active ? colors.primaryInk : colors.textFaint;
  return (
    <Pressable style={[styles.tab, locked && styles.tabLocked]} onPress={onPress}>
      <MaterialCommunityIcons name={tab.icon} size={20} color={tint} />
      <Text style={[styles.label, { color: tint }, active && styles.labelOn]} numberOfLines={1}>
        {tab.label}
      </Text>
      {locked && (
        <View style={styles.lock}>
          <MaterialCommunityIcons name="lock" size={9} color={colors.textFaint} />
        </View>
      )}
      {!locked && tab.soon && (
        <View style={styles.soon}>
          <Text style={styles.soonText}>YAKINDA</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'relative',
    height: 78,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, position: 'relative' },
  tabLocked: { opacity: 0.45 },
  centerGap: { width: 84 },
  label: {
    fontFamily: font.bodyBold,
    fontSize: text.micro.fontSize,
    lineHeight: text.micro.lineHeight,
  },
  labelOn: { fontFamily: font.bodyBlack },
  labelOff: { color: colors.textFaint },
  labelPlayOn: { fontFamily: font.bodyBlack, color: colors.primaryInk },
  lock: { position: 'absolute', top: -2, right: 20 },
  soon: {
    position: 'absolute',
    top: -3,
    right: 12,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.sunken,
  },
  soonText: { fontFamily: font.bodyBlack, fontSize: 8, lineHeight: 12, color: colors.textFaint, letterSpacing: 0.3 },
  center: { position: 'absolute', left: '50%', top: -16, marginLeft: -31, alignItems: 'center', gap: 3 },
  playBase: { backgroundColor: colors.primaryDark, borderRadius: radius.pill },
  playFace: {
    width: 62,
    height: 62,
    marginBottom: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
});
