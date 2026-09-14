import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, shadow, text } from '@/constants/theme';

type Key = 'menu' | 'squad' | 'battle' | 'collection' | 'howto';
type Href = '/' | '/squad' | '/difficulty' | '/collection' | '/how-to-play';

const SIDE_ITEMS: {
  key: Key;
  label: string;
  href: Href;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { key: 'menu', label: 'Menü', href: '/', icon: 'home' },
  { key: 'squad', label: 'Düzenle', href: '/squad', icon: 'tune' },
];
const SIDE_ITEMS_RIGHT: (typeof SIDE_ITEMS)[number][] = [
  { key: 'collection', label: 'Koleksiyon', href: '/collection', icon: 'view-grid' },
  { key: 'howto', label: 'Yardım', href: '/how-to-play', icon: 'help-circle' },
];

function activeKey(pathname: string): Key {
  if (pathname === '/squad') return 'squad';
  if (pathname === '/difficulty') return 'battle';
  if (pathname.startsWith('/how-to-play')) return 'howto';
  if (pathname.startsWith('/collection') || pathname.startsWith('/card')) return 'collection';
  return 'menu';
}

/** Docked to the very bottom edge, full width — no floating side gap. Two
 *  regular tabs on each side (so the center button lands exactly in the
 *  middle), with "Savaşa Başla" as a raised, unmissable circle in between —
 *  it's the one thing most players want to do most of the time. */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const active = activeKey(pathname);

  const renderItem = (item: (typeof SIDE_ITEMS)[number]) => {
    const on = item.key === active;
    const tint = on ? colors.primaryInk : colors.textFaint;
    return (
      <Pressable
        key={item.key}
        style={[styles.item, on && styles.itemOn]}
        onPress={() => {
          if (!on) router.replace(item.href);
        }}
      >
        <MaterialCommunityIcons name={item.icon} size={19} color={tint} />
        <Text style={[styles.label, { color: tint }]}>{item.label}</Text>
      </Pressable>
    );
  };

  const battleOn = active === 'battle';

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
        {SIDE_ITEMS.map(renderItem)}

        <Pressable
          style={styles.battleItem}
          onPress={() => {
            if (!battleOn) router.push('/difficulty');
          }}
        >
          <View style={[styles.battleCircle, battleOn && styles.battleCircleOn]}>
            <MaterialCommunityIcons name="lightning-bolt" size={22} color="#FFFFFF" />
          </View>
          <Text style={[styles.label, { color: colors.accentInk }]}>Savaş</Text>
        </Pressable>

        {SIDE_ITEMS_RIGHT.map(renderItem)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.raised,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  itemOn: { backgroundColor: colors.primarySoft },
  label: { fontFamily: font.bodyBold, fontSize: text.caption.fontSize, lineHeight: text.caption.lineHeight },
  // Same footprint as a regular item so the two flanking it stay flex:1 and
  // truly symmetric — the circle itself is just visually bigger and louder.
  battleItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  battleCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: -14,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  battleCircleOn: { backgroundColor: colors.accentDark },
});
