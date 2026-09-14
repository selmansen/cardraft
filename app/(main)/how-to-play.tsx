import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChunkyButton } from '@/components/ChunkyButton';
import { colors, font, NAV_CLEARANCE, radius, space, text } from '@/constants/theme';
import { useGameStore } from '@/store/gameStore';

const STAT_LEGEND: { k: string; v: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string }[] = [
  { k: 'YAKIT', v: 'Kart oynamak yakıt ister! Her turda deponda 1 birim daha birikir.', icon: 'water', tint: colors.primaryInk },
  { k: 'GÜÇ', v: 'Saldırınca rakibe verdiğin hasar tam olarak bu kadar.', icon: 'lightning-bolt', tint: colors.accent },
  { k: 'DAYANIKLILIK', v: 'Aracının canı! Sıfırlanınca hurdaya döner ve sahadan çıkar.', icon: 'shield', tint: colors.success },
  { k: 'HIZ', v: 'Rakipten en az 3 fazla hızın varsa vur-kaç yaparsın, karşılık hasarı yemezsin.', icon: 'chevron-double-right', tint: colors.primary },
];

const TURN_STEPS = [
  ['1 · Çek & yakıt al', 'Her turun başında otomatik 1 kart çekersin, yakıtın da 1 artar. İlk tur 1 yakıtla başlarsın, sonra 2, 3… tam 10\'a kadar çıkar.'],
  ['2 · Araç sür', 'Elindeki bir kartı yukarı sürükleyip boş yuvalardan birine bırak. Üzerindeki yakıt kadar ödeyip yerini alır. Sahanda 3 yuva var; üçü de doluyken yeni bir kartı sahadaki araçlarından birinin üstüne bırakırsan o araç hurdaya ayrılır, yerini yenisi alır.'],
  ['3 · Pit Ekibi\'ni kullan (istersen)', 'Mor kartlar Pit Ekibi\'nden: yakıt harcamazlar, sahaya çıkmazlar, turda en fazla 1 tanesi kullanılır. Hedefsiz olanı yukarı sürükle, hedefli olanı doğrudan etkileyeceği araca sürükle. Tamamen isteğe bağlı, kullanmak zorunda değilsin.'],
  ['4 · Saldır', 'Sahandaki yeşil çerçeveli bir aracını tut, hedefe doğru sürükleyip bırak: rakibin bir aracı ya da doğrudan garajı olabilir! Az önce sürdüğün araç bu tur saldıramaz, bir tur dinlenmesi gerekir (Nitro ve Atılım bunun dışında, onlar hemen atılır).'],
  ['5 · Turu bitir', 'Elinden gelen bu kadarsa "Turu Bitir"e bas. Sıra rakibe geçer, o hamlesini yapar, sonra top yine sende.'],
];

const ABILITIES = [
  ['Atılım', 'Sahaya adım atar atmaz saldırıya geçer! Diğer araçlar bir tur beklemek zorunda ama bu, beklemeyi hiç sevmiyor.'],
  ['Nitro', 'Sahaya girer girmez turboya basar: gücüne anında bonus gelir ve hemen saldırabilir. Ama bu fazladan güç sadece o tur sürer, sonra uçup gider.'],
  ['Çarpma', 'Sahaya girerken yolun üstündeki rastgele bir rakip araca çarpıp hasar verir. Tam bir sürpriz!'],
  ['Siper', 'Bu araç ayakta olduğu sürece garajının önünde nöbet tutar. Rakip önce onu devirmeden garajına dokunamaz.'],
  ['Yıpratma', 'Sahada kaldığı her tur sonunda rastgele bir rakip araca küçük bir hasar verir. Sabırlı ama inatçı.'],
  ['İkiz Vuruş', 'Aynı turda iki kez saldırabilir! Bunun karşılığında gücü biraz daha düşük başlar.'],
  ['Egzoz Patlaması', 'Sahaya girdiği an rakibin garajına doğrudan patlar. Siper bile onu durduramaz!'],
  ['Konvoy', 'Sahada olduğu sürece yanındaki dostlarına güç üfler. Takım ruhunu seviyor.'],
];

const TIPS = [
  'Araç araca vurduğunda ikisi de hasar alır, buna "karşılık" diyoruz. Ama aracın rakibinden çok hızlıysa (fark 3 ya da daha fazla), vurur vurmaz kaçarsın, karşılık yemezsin.',
  'Rakipte "Siper" yeteneği olan bir araç varsa boşuna garaja yüklenme, önce onu devirmen lazım.',
  'Ucuz araçlarını rakibin güçlülerine karşı feda et, garaja son darbeyi sona sakla.',
  'Zorlanıyorsan hiç sıkıntı yok: Savaşa Başla → Zorluk: Kolay\'ı seç, bot orada bol bol hata yapar.',
];

export default function HowToPlay() {
  const router = useRouter();
  const markSeen = useGameStore((s) => s.markHowToPlaySeen);

  /**
   * `replace` kullanılıyor, `back()` değil: ilk açılışta bu ekran Oyna
   * ekranından otomatik açılıyor ve `back()` yığında aşağıda kalmış başka bir
   * kopyaya düşebiliyordu — "düğme ancak ikinci basışta çalışıyor" gibi
   * okunuyordu. `replace` yığın nasıl olursa olsun tek dokunuşta çıkarıyor.
   *
   * Hedef OYNA ekranı, Profil değil: öğreticiyi ilk kez gören oyuncu
   * ayarlar sayfasına değil oyuna düşmeli. Profil'den gelen oyuncu da
   * oradan tek dokunuşla geri dönebiliyor.
   */
  const done = () => {
    markSeen();
    router.replace('/');
  };
  // Breadcrumb — leaves without marking the tutorial "seen" (only the CTA at
  // the bottom does that), so it can still greet a first-time player.
  const leave = () => router.replace('/');

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={leave}>
          <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Oyna</Text>
        </Pressable>

        <Text style={styles.h1}>Nasıl Oynanır?</Text>
        <Text style={styles.lead}>
          Sıra sende, sonra rakipte. Böyle gider bu kart savaşı!{' '}
        </Text>
        <Text style={styles.lead}>
          <Text style={styles.bold}>Amacın:</Text> rakibinin garaj canını (en üstteki çubuk) sıfırlamak.
          Ama dikkat, o da tam olarak aynısını sana yapmaya çalışıyor!
        </Text>

        <Text style={styles.h2}>Karttaki sayılar ne anlama gelir?</Text>
        <View style={styles.card}>
          {STAT_LEGEND.map((row) => (
            <View key={row.k} style={styles.legendRow}>
              <View style={styles.legendIcon}>
                <MaterialCommunityIcons name={row.icon} size={15} color={row.tint} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.legendK}>{row.k}</Text>
                <Text style={styles.legendV}>{row.v}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Bir tur nasıl geçer?</Text>
        {TURN_STEPS.map(([t, d]) => (
          <View key={t} style={styles.card}>
            <Text style={styles.stepTitle}>{t}</Text>
            <Text style={styles.stepText}>{d}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Yetenekler</Text>
        <View style={styles.card}>
          {ABILITIES.map(([label, desc], i) => (
            <View key={label} style={[styles.abilityRow, i < ABILITIES.length - 1 && styles.abilityDivider]}>
              <View style={styles.abilityDot} />
              <Text style={styles.abilityText}>
                <Text style={styles.abilityLabel}>{label}: </Text>
                {desc}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>İpuçları</Text>
        <View style={styles.card}>
          {TIPS.map((t) => (
            <Text key={t} style={styles.bullet}>
              • {t}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 12, paddingBottom: NAV_CLEARANCE + space.lg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: font.bodyBold, fontSize: text.small.fontSize, color: colors.textMuted },
  h1: { fontFamily: font.display, fontSize: 24, color: colors.ink },
  h2: { fontFamily: font.headingSm, fontSize: 16, color: colors.ink, marginTop: space.xs },
  lead: { fontFamily: font.body, fontSize: text.body.fontSize, lineHeight: text.body.lineHeight + 2, color: colors.inkSoft },
  bold: { fontFamily: font.bodyBold, color: colors.ink },
  card: {
    gap: 10,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  legendIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  legendK: { fontFamily: font.bodyBold, fontSize: text.caption.fontSize, letterSpacing: 0.5, color: colors.ink },
  legendV: { fontFamily: font.body, fontSize: text.small.fontSize, lineHeight: text.small.lineHeight, color: colors.textMuted },
  stepTitle: { fontFamily: font.bodyBold, fontSize: text.bodyLg.fontSize, color: colors.accentInk },
  stepText: { fontFamily: font.body, fontSize: text.small.fontSize, lineHeight: text.small.lineHeight + 3, color: colors.inkSoft },
  abilityRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingBottom: 10 },
  abilityDivider: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 0 },
  abilityDot: { width: 7, height: 7, marginTop: 6, borderRadius: 4, backgroundColor: colors.accent },
  abilityText: { flex: 1, fontFamily: font.body, fontSize: text.small.fontSize, lineHeight: text.small.lineHeight + 3, color: colors.inkSoft },
  abilityLabel: { fontFamily: font.bodyBold, color: colors.ink },
  bullet: { fontFamily: font.body, fontSize: text.small.fontSize, lineHeight: text.small.lineHeight + 3, color: colors.inkSoft },
});
