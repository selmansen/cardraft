import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, NAV_CLEARANCE, radius, shadow, space, text } from '@/constants/theme';

/**
 * LİG — henüz yok, yeri ayrıldı.
 *
 * Sekme şimdiden duruyor çünkü sonradan eklenirse alt menü yeniden
 * düzenlenir ve oyuncunun kas hafızası bozulur. Boş bir ekran yerine ne
 * geleceğini anlatıyor: bekleyen bir şey olduğunu bilmek, hiçbir şey
 * olmadığını sanmaktan iyi.
 *
 * Sosyal (arkadaşlar) da buraya gelecek — Profil'de kaybolurdu, ayrı sekme
 * altıncı yuva demekti.
 */
const COMING: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; sub: string }[] = [
  {
    icon: 'trophy-variant',
    title: 'Sıralama',
    sub: 'Kazandıkça yüksel, sezon sonunda ödül al',
  },
  {
    icon: 'sword-cross',
    title: 'Gerçek rakipler',
    sub: 'Bota karşı değil, senin seviyendeki oyunculara karşı',
  },
  {
    icon: 'account-multiple',
    title: 'Arkadaşlar',
    sub: 'Ekle, meydan oku, rövanş al',
  },
];

export default function LeagueScreen() {
  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <Text style={styles.title}>Lig</Text>

      <View style={styles.body}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="trophy-variant" size={44} color={colors.primaryInk} />
        </View>
        <Text style={styles.heading}>Lig sistemi yolda</Text>
        <Text style={styles.lead}>
          Şimdilik bota karşı oynuyorsun. Lig geldiğinde sıralamada yerini alacaksın.
        </Text>

        <View style={styles.list}>
          {COMING.map((item) => (
            <View key={item.title} style={styles.row}>
              <MaterialCommunityIcons name={item.icon} size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSub}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Lige girmek için 20 araç ve 5 Pit Ekibi kartı gerekecek — koleksiyonunu şimdiden
          büyütmeye başlayabilirsin.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontFamily: font.heading,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: space.lg,
    paddingBottom: NAV_CLEARANCE,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heading: { fontFamily: font.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  lead: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: {
    width: '100%',
    marginTop: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowTitle: { fontFamily: font.bodyBlack, fontSize: text.body.fontSize, color: colors.ink },
  rowSub: { fontFamily: font.body, fontSize: text.bodySmall.fontSize, color: colors.textMuted },
  note: {
    marginTop: 6,
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
