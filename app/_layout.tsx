import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, font } from '@/constants/theme';
import { useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';

export default function RootLayout() {
  const hydrated = useGameStore((s) => s.hydrated);
  const bootstrap = useSessionStore((s) => s.bootstrap);

  /**
   * Sunucu oturumu açılışta bir kez kuruluyor: yoksa misafir hesap açılıyor,
   * varsa cüzdan tazeleniyor.
   *
   * Açılışı BEKLETMİYOR (`ready` buna bağlı değil). Sunucu erişilemezse oyun
   * çevrimdışı oynanabiliyor; bekletmek, uçaktaki oyuncuyu açılış ekranında
   * sonsuza kadar tutmak olurdu.
   */
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  const [fontsLoaded, fontError] = useFonts({
    'Baloo2-Bold': require('../assets/fonts/Baloo2-Bold.ttf'),
    'Baloo2-ExtraBold': require('../assets/fonts/Baloo2-ExtraBold.ttf'),
    'Nunito-SemiBold': require('../assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold': require('../assets/fonts/Nunito-Bold.ttf'),
    'Nunito-Black': require('../assets/fonts/Nunito-Black.ttf'),
  });

  const ready = hydrated && (fontsLoaded || !!fontError);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {ready ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(main)" />
            <Stack.Screen name="battle" options={{ gestureEnabled: false }} />
          </Stack>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Garaj açılıyor…</Text>
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg },
  loadingText: { color: colors.textMuted, fontFamily: font.bodyBold },
});
