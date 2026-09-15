import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChunkyButton } from '@/components/ChunkyButton';
import { WalletPill } from '@/components/Currency';
import { colors, font, radius, shadow, space, text } from '@/constants/theme';
import { EmptySlot, SquadSlot } from '@/components/SquadSlot';
import { DIFFICULTY, DIFFICULTY_ORDER, type Difficulty } from '@/game/difficulty';
import { LOADOUT_TOTAL, useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useWallet } from '@/store/useWallet';

/**
 * OYNA — oyunun ana ekranı ve alt menünün merkez düğmesi.
 *
 * Eskiden burası bir "Menü"ydü: içi başka sekmelere giden satırlardan ibaret
 * bir ara katman. Şimdi ekranın tek işi maça çıkarmak; zorluk seçimi de
 * buraya geldi çünkü ayrı bir ekrana gitmeyi gerektirecek kadar ağır bir
 * karar değil ve savaşa çıkmadan önce görülmesi gereken tek bilgi bu.
 */
export default function PlayScreen() {
  const router = useRouter();
  const { rims, coins } = useWallet();
  const isGuest = useSessionStore((s) => s.user?.isGuest ?? true);
  const won = useGameStore((s) => s.battlesWon);
  const streak = useGameStore((s) => s.battlesPlayed);
  const loadout = useGameStore((s) => s.loadout);
  const supportLoadout = useGameStore((s) => s.supportLoadout);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const howToPlaySeen = useGameStore((s) => s.howToPlaySeen);

  /**
   * Ekrana her dönüşte cüzdan ve koleksiyon tazeleniyor.
   *
   * Gerekli çünkü ikisi de BAŞKA YERDE değişiyor: maç ödülünü sunucu yazıyor
   * (savaş ekranı), kart açma ve paket de sunucuda. Sadece açılışta
   * okusaydık, oyuncu maçtan döndüğünde eski bakiyeyi görürdü.
   */
  const refreshWallet = useSessionStore((s) => s.refreshWallet);
  const refreshInventory = useSessionStore((s) => s.refreshInventory);
  useFocusEffect(
    useCallback(() => {
      void refreshWallet();
      void refreshInventory();
    }, [refreshWallet, refreshInventory]),
  );


  const total = loadout.length + supportLoadout.length;
  const ready = total === LOADOUT_TOTAL;

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      {/* ÜST: kimlik + cüzdan. Misafirde cüzdan GÖSTERİLMİYOR — "0 jant"
          bilgi değil gürültü ve her açılışta oyuncuya bir şeyi olmadığını
          hatırlatıyor. Yerine giriş çağrısı var. */}
      <View style={styles.header}>
        <Pressable style={styles.identity} onPress={() => router.replace('/profile')}>
          <View style={[styles.avatar, isGuest && styles.avatarGuest]}>
            <MaterialCommunityIcons
              name="account"
              size={20}
              color={isGuest ? colors.textFaint : colors.primaryInk}
            />
          </View>
          <View>
            <Text style={[styles.name, isGuest && styles.nameGuest]}>
              {isGuest ? 'Misafir' : 'Sürücü'}
            </Text>
            <Text style={styles.sub}>
              {isGuest ? `${streak} maç oynadın` : `${won} galibiyet`}
            </Text>
          </View>
        </Pressable>

        {isGuest ? (
          <Pressable style={styles.signInPill} onPress={() => router.push('/sign-in')}>
            <MaterialCommunityIcons name="login" size={14} color={colors.primaryInk} />
            <Text style={styles.signInText}>Giriş yap</Text>
          </Pressable>
        ) : (
          <WalletPill rims={rims} coins={coins} />
        )}
      </View>

      <View style={styles.body}>
        {/* Misafire ne kaçırdığını söyleyen tek şerit. Ekranın her yerinde
            tekrarlanmıyor: bir kez duruyor, oyuncu hazır olduğunda dokunuyor. */}
        {isGuest && (
          <Pressable style={styles.guestBanner} onPress={() => router.push('/sign-in')}>
            <MaterialCommunityIcons name="shopping" size={22} color={colors.primaryInk} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guestTitle}>Kartların ve jantın kayıtlı değil</Text>
              <Text style={styles.guestSub}>Giriş yap, 350 jant hediye ile başla</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primaryInk} />
          </Pressable>
        )}

        {/* Öğretici artık uygulamayı AÇMIYOR — oyuncu oyuna düşüyor, kurallar
            burada duruyor. Açılışta bir eğitim ekranıyla karşılamak, oynamaya
            gelen oyuncuyu okumaya zorlamak demekti. */}
        {!howToPlaySeen && (
          <Pressable style={styles.tutorialRow} onPress={() => router.push('/how-to-play')}>
            <MaterialCommunityIcons name="school-outline" size={20} color={colors.accentDark} />
            <Text style={styles.tutorialText}>İlk kez mi oynuyorsun? Kuralları öğren</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.accentDark} />
          </Pressable>
        )}

        <View>
          <Text style={styles.sectionLabel}>ZORLUK</Text>
          <View style={styles.difficultyRow}>
            {DIFFICULTY_ORDER.map((id: Difficulty) => {
              const on = difficulty === id;
              return (
                <Pressable
                  key={id}
                  style={[styles.diffChip, on && styles.diffChipOn]}
                  onPress={() => setDifficulty(id)}
                >
                  <Text style={[styles.diffText, on && styles.diffTextOn]}>{DIFFICULTY[id].label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Kadro özeti: "hazır mıyım" sorusunun cevabı savaşa çıkmadan
            görünüyor. Dokununca Garaj'a. */}
        {/* Kutunun TAMAMI dokunulabilir DEĞİL: içindeki yatay kaydırma dış
            Pressable tarafından yutuluyordu — oyuncu kadroyu kaydırmaya
            çalışınca Garaj açılıyordu. Gezinme yalnızca başlık satırında. */}
        <View style={styles.squadCard}>
          <Pressable style={styles.squadHead} onPress={() => router.replace('/garage')}>
            <Text style={styles.squadTitle}>{isGuest ? 'Başlangıç kadrosu' : 'Kadron'}</Text>
            <View style={styles.squadLink}>
              <Text style={[styles.squadCount, !ready && styles.squadCountWarn]}>
                {total} / {LOADOUT_TOTAL}
              </Text>
              <Text style={styles.squadEdit}>Düzenle</Text>
              <MaterialCommunityIcons name="chevron-right" size={15} color={colors.primaryInk} />
            </View>
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.squadRow}
          >
            {loadout.map((id) => (
              <SquadSlot key={id} cardId={id} />
            ))}
            {/* Pit kartları da yuva olarak diziliyor, "3 pit" yazısı olarak
                değil: araçlar görsel, pit yazıysa kadro yarım görünüyordu. */}
            {supportLoadout.map((id) => (
              <SquadSlot key={id} cardId={id} kind="support" />
            ))}
            {Array.from({ length: Math.max(0, LOADOUT_TOTAL - total) }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} />
            ))}
          </ScrollView>
        </View>

        <ChunkyButton variant="accent" height={76} onPress={() => router.push('/battle')} disabled={!ready}>
          <View style={styles.playInner}>
            <MaterialCommunityIcons name="play" size={28} color={colors.ink} />
            <Text style={styles.playText}>SAVAŞA BAŞLA</Text>
          </View>
        </ChunkyButton>

        {!ready && (
          <Text style={styles.notReady}>
            Savaşa çıkmak için kadronu {LOADOUT_TOTAL} karta tamamla.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: 14,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  avatarGuest: { backgroundColor: colors.sunken },
  name: { fontFamily: font.headingSm, fontSize: 15, lineHeight: 19, color: colors.ink },
  nameGuest: { color: colors.textMuted },
  sub: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.textMuted },
  signInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  signInText: { fontFamily: font.bodyBlack, fontSize: text.bodySmall.fontSize, color: colors.primaryInk },

  body: { flex: 1, justifyContent: 'center', gap: 14, paddingHorizontal: space.md },

  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  guestTitle: { fontFamily: font.bodyBlack, fontSize: text.body.fontSize, color: colors.primaryInk },
  guestSub: { fontFamily: font.body, fontSize: text.bodySmall.fontSize, color: colors.primaryInk, opacity: 0.8 },

  tutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
  },
  tutorialText: {
    flex: 1,
    fontFamily: font.bodyBold,
    fontSize: text.body.fontSize,
    color: colors.accentDark,
  },
  sectionLabel: {
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginBottom: 7,
  },
  difficultyRow: { flexDirection: 'row', gap: 6 },
  diffChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  diffChipOn: { backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary },
  diffText: { fontFamily: font.bodyBold, fontSize: text.body.fontSize, color: colors.textMuted },
  diffTextOn: { fontFamily: font.bodyBlack, color: colors.primaryInk },

  squadCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  squadHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  squadTitle: { fontFamily: font.headingSm, fontSize: 15, lineHeight: 19, color: colors.ink },
  squadLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  squadEdit: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.primaryInk },
  squadCount: { fontFamily: font.bodyBlack, fontSize: text.bodySmall.fontSize, color: colors.successInk },
  squadCountWarn: { color: colors.accentDark },
  squadRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },

  playInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /**
   * `lineHeight` VERİLMİYOR — bilerek.
   *
   * Baloo 2'nin doğal satır kutusu yazıyı kendi içinde dengeliyor; elle bir
   * satır yüksekliği vermek o dengeyi bozuyordu. Font boyutuna eşit verince
   * (26/26) üstten kırpıldı, büyük verince (26/30) yukarı kaydı. Değeri
   * belirtmeyince RN fontun kendi metriğini kullanıyor ve düğme içinde
   * ortalanıyor. `includeFontPadding` Android'de ayrıca üstte boşluk
   * eklediği için kapalı.
   */
  playText: {
    fontFamily: font.display,
    fontSize: 26,
    color: colors.ink,
    includeFontPadding: false,
  },
  notReady: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    color: colors.accentDark,
    textAlign: 'center',
  },
});
