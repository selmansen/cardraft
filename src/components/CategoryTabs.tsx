import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, font, radius, text } from '@/constants/theme';

interface Props<T extends string> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}

/**
 * Horizontal category chip row, shared by Collection and Squad so filtering
 * looks and behaves identically in both.
 */
export function CategoryTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.wrap}
      contentContainerStyle={styles.row}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
          >
            <Text style={[styles.text, { color: on ? '#FFFFFF' : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Chip height (34) + the row's own top/bottom padding (8+8), given as an
// explicit height rather than left to auto-sizing, just to keep this row's
// footprint predictable — not load-bearing for the border visibility fix
// below (that turned out to be a contrast problem, not a clipping one).
const TAB_ROW_HEIGHT = 34 + 8 + 8;

const styles = StyleSheet.create({
  wrap: { flexGrow: 0, height: TAB_ROW_HEIGHT, marginBottom: 4 },
  row: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  // colors.border is a near-background beige — nearly invisible between a
  // white chip and the cream page, regardless of any clipping. borderStrong
  // is the one actually meant for outlines that need to read against colors.bg.
  chipOff: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  text: {
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.fontSize + 2,
    includeFontPadding: false,
  },
});
