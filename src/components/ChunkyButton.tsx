import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, font, radius, text } from '@/constants/theme';

type Variant = 'primary' | 'accent' | 'secondary' | 'danger';

const VARIANTS: Record<Variant, { face: string; base: string; text: string }> = {
  primary: { face: colors.primary, base: colors.primaryDark, text: '#FFFFFF' },
  accent: { face: colors.accent, base: colors.accentDark, text: colors.ink },
  secondary: { face: colors.surface, base: colors.primarySoft, text: colors.primaryInk },
  danger: { face: colors.dangerInk, base: '#8E1E1C', text: '#FFFFFF' },
};

interface Props {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Design-system "chunky" button: face sits 4px above a coloured base and
 *  presses down into it, like a keycap. */
export function ChunkyButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  height = 52,
  style,
  children,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANTS[variant];
  const down = pressed && !disabled;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[{ borderRadius: radius.pill, backgroundColor: v.base }, disabled && styles.disabled, style]}
    >
      <View
        style={[
          styles.face,
          {
            height,
            backgroundColor: variant === 'secondary' ? v.face : v.face,
            borderRadius: radius.pill,
            borderWidth: variant === 'secondary' ? 2 : 0,
            borderColor: colors.primarySoft,
            transform: [{ translateY: down ? 4 : 0 }],
            marginBottom: down ? 0 : 4,
          },
        ]}
      >
        {children ?? (
          <Text style={[styles.label, { color: v.text }]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // flexDirection must be 'row': a column face gives `flex:1` custom children
  // no width to fill, which is what broke internal space-between layouts.
  face: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  label: { fontFamily: font.bodyBlack, fontSize: text.bodyLg.fontSize, lineHeight: text.bodyLg.lineHeight, letterSpacing: 0.2 },
  disabled: { opacity: 0.45 },
});
