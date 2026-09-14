import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, NAV_CLEARANCE, radius, space, text } from '@/constants/theme';
import { DIFFICULTY, DIFFICULTY_ORDER, type Difficulty } from '@/game/difficulty';
import { LOADOUT_TOTAL, useGameStore } from '@/store/gameStore';

const TINT: Record<Difficulty, string> = {
  easy: colors.success,
  normal: colors.primary,
  hard: colors.danger,
};
const INK: Record<Difficulty, string> = {
  easy: colors.successInk,
  normal: colors.primaryInk,
  hard: colors.dangerInk,
};

export default function DifficultyScreen() {
  const router = useRouter();
  const current = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const vehicleCount = useGameStore((s) => s.loadout.length);
  const supportCount = useGameStore((s) => s.supportLoadout.length);
  const totalCount = vehicleCount + supportCount;
  // Full 8 required, not just "enough to play" — half-filled kadros used to
  // slip into battle unnoticed (e.g. 7/8), so now it's all-or-nothing.
  const loadoutOk = totalCount === LOADOUT_TOTAL;

  const start = (d: Difficulty) => {
    if (!loadoutOk) {
      Alert.alert(
        'Kadronu Tamamla',
        `Savaşa çıkmak için kadronu tam ${LOADOUT_TOTAL} karta tamamlamalısın. Şu an ${totalCount}/${LOADOUT_TOTAL} kartın var.`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Kadroya Git', onPress: () => router.push('/squad') },
        ],
      );
      return;
    }
    setDifficulty(d);
    router.replace('/battle');
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Menü</Text>
        </Pressable>

        <Text style={styles.title}>Zorluğu seç, savaş başlasın.</Text>

        <View style={styles.squadPill}>
          <MaterialCommunityIcons
            name={loadoutOk ? 'check-circle' : 'alert-circle'}
            size={13}
            color={loadoutOk ? colors.successInk : colors.dangerInk}
          />
          <Text style={[styles.squadPillText, { color: loadoutOk ? colors.successInk : colors.dangerInk }]}>
            Kadron: {totalCount}/{LOADOUT_TOTAL}
          </Text>
        </View>

        {DIFFICULTY_ORDER.map((d) => {
          const p = DIFFICULTY[d];
          const active = current === d;
          return (
            <Pressable
              key={d}
              style={[styles.opt, { borderColor: active ? TINT[d] : colors.border }]}
              onPress={() => start(d)}
            >
              <View style={styles.optHead}>
                <Text style={styles.optLabel}>{p.label}</Text>
                {active ? (
                  <Text style={[styles.optTag, { color: INK[d] }]}>SON SEÇİLEN</Text>
                ) : null}
              </View>
              <Text style={styles.optBlurb}>{p.blurb}</Text>
            </Pressable>
          );
        })}

        <Text style={styles.note}>
          Zorluğu dilediğin an değiştirebilirsin, hep bu ekrandan. Kadronu düzenlemek için geri dön.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingTop: space.md, gap: 14, paddingBottom: NAV_CLEARANCE + space.lg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: font.bodyBold, fontSize: 13, color: colors.textMuted },
  title: { fontFamily: font.display, fontSize: 22, color: colors.ink },
  squadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.sunken,
  },
  squadPillText: { fontFamily: font.bodyBold, fontSize: text.caption.fontSize },
  opt: {
    gap: 6,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.xl,
  },
  optHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optLabel: { fontFamily: font.display, fontSize: 19, color: colors.ink },
  optTag: { fontFamily: font.bodyBold, fontSize: text.caption.fontSize, letterSpacing: 0.6 },
  optBlurb: { fontFamily: font.body, fontSize: text.small.fontSize, lineHeight: text.small.lineHeight + 1, color: colors.textMuted },
  note: { textAlign: 'center', fontFamily: font.body, fontSize: text.small.fontSize, lineHeight: text.small.lineHeight, color: colors.textFaint },
});
