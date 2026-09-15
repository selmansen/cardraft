import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ChunkyButton } from '@/components/ChunkyButton';
import { colors, font, radius, shadow, space, text } from '@/constants/theme';

/**
 * Uygulamanın kendi diyaloğu — `Alert.alert` yerine.
 *
 * `Alert.alert` işletim sisteminin diyaloğunu açıyor: iOS'ta sistem fontu ve
 * mavi düğmeler, Android'de bambaşka bir görünüm. Oyunun geri kalanı Baloo 2,
 * krem zemin ve "chunky" düğmelerle kuruluyken silme onayının sistem
 * diyaloğuyla sorulması, uygulamanın ortasında başka bir uygulama açılmış
 * gibi duruyordu.
 *
 * Emir kipiyle çağrılıyor (`dialog.show(...)`) çünkü kullanım yerleri de öyle:
 * bir düğmeye basıldığında soruluyor, bir durum değişkeninden doğmuyor. Her
 * ekranın kendi `visible` state'ini tutması gereksiz tekrar olurdu.
 */
export interface DialogAction {
  label: string;
  onPress?: () => void;
  /** 'danger' kırmızı, 'primary' mavi, 'cancel' çerçeveli. Varsayılan cancel. */
  variant?: 'primary' | 'danger' | 'cancel';
}

export interface DialogOptions {
  title: string;
  message?: string;
  actions: DialogAction[];
}

const DialogContext = createContext<{ show: (options: DialogOptions) => void } | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog, DialogProvider içinde kullanılmalı');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const show = useCallback((next: DialogOptions) => setOptions(next), []);
  const value = useMemo(() => ({ show }), [show]);

  function run(action: DialogAction) {
    setOptions(null);
    action.onPress?.();
  }

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal visible={options !== null} transparent animationType="none">
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.scrim}>
          {/* Karartmaya dokunmak kapatmıyor: bu diyaloglar bir karar
              istiyor ve yanlışlıkla kapatılan bir onay, cevaplanmamış bir
              soru bırakır. */}
          <Pressable style={StyleSheet.absoluteFill} />
          <Animated.View entering={ZoomIn.duration(180)} style={styles.panel}>
            <Text style={styles.title}>{options?.title}</Text>
            {options?.message ? <Text style={styles.message}>{options.message}</Text> : null}
            <View style={styles.actions}>
              {options?.actions.map((action) => (
                <ChunkyButton
                  key={action.label}
                  label={action.label}
                  variant={
                    action.variant === 'danger'
                      ? 'danger'
                      : action.variant === 'primary'
                        ? 'primary'
                        : 'secondary'
                  }
                  onPress={() => run(action)}
                />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </DialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,18,28,0.64)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: space.lg,
    ...shadow.raised,
  },
  title: { fontFamily: font.heading, fontSize: 22, lineHeight: 28, color: colors.ink, textAlign: 'center' },
  message: {
    marginTop: 8,
    fontFamily: font.body,
    fontSize: text.body.fontSize,
    lineHeight: text.body.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },
  /** Düğmeler ALT ALTA: yan yana dizilince uzun etiketler ("Hesabı sil")
   *  sıkışıyor ve yıkıcı seçenek kazara basılabilecek kadar küçülüyor. */
  actions: { marginTop: space.lg, gap: 10 },
});
