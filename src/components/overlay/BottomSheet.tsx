import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, radius, space, shadow } from '@/constants/theme';

/**
 * Alt sayfa — karartma SOLUYOR, panel AŞAĞIDAN geliyor.
 *
 * React Native'in kendi `Modal` animasyonları ikisini ayıramıyor: `slide`
 * karartmayı da panelle birlikte yukarı kaydırıyor (ekranın altından siyah
 * bir blok geliyormuş gibi), `fade` ise paneli de soluk soluk gösteriyor.
 * Doğrusu ikisinin AYRI davranması: karartma bir ortam değişikliği (opaklık),
 * panel bir nesne (konum).
 *
 * Bu yüzden Modal animasyonsuz açılıyor ve iki hareket burada ayrı ayrı
 * sürülüyor.
 */
const DURATION = 220;

export function BottomSheet({
  visible,
  onClose,
  children,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: DURATION });
  }, [visible, progress]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Scrim progress={progress} onPress={onClose} />
      <Sheet progress={progress} style={style}>
        {children}
      </Sheet>
    </Modal>
  );
}

function Scrim({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const animated = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View style={[styles.scrim, animated]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
    </Animated.View>
  );
}

function Sheet({
  progress,
  children,
  style,
}: {
  progress: SharedValue<number>;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  // 600 px: en uzun alt sayfadan da yüksek. Tam yüksekliği ölçmek için
  // onLayout beklemek, ilk açılışta panelin bir kare boyunca yerinde
  // görünmesine yol açıyordu.
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 600 }],
  }));
  return (
    <Animated.View style={[styles.sheet, style, animated]}>
      <View style={styles.grabber} />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,18,28,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: space.md,
    paddingTop: 12,
    paddingBottom: space.xl,
    ...shadow.raised,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: space.md,
  },
});
