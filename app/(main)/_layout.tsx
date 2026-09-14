import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BottomNav } from '@/components/BottomNav';
import { colors } from '@/constants/theme';

export default function MainLayout() {
  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
