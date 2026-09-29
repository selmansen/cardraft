import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { storeApi } from '@/api/endpoints';
import type { PackDto, Rarity } from '@/api/types';
import { ChunkyButton } from '@/components/ChunkyButton';
import { CURRENCY, CurrencyTag, WalletPill } from '@/components/Currency';
import { BottomSheet } from '@/components/overlay/BottomSheet';
import { FEATURES } from '@/constants/features';
import { colors, font, NAV_CLEARANCE, radius, rarity as rarityTheme, shadow, space, text } from '@/constants/theme';
import { useSessionStore } from '@/store/sessionStore';
import { useWallet } from '@/store/useWallet';
import type { Currency } from '@/types';

/** Nadirliklerin gösterim sırası — oranlar nesnesinin anahtar sırasına
 *  güvenilmez, ayrıca oyuncu her pakette aynı sırayı görmeli. */
const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export default function StoreScreen() {
  const router = useRouter();
  const { rims, coins } = useWallet();
  const connection = useSessionStore((s) => s.connection);

  const [packs, setPacks] = useState<PackDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Oranları açık olan paket; null ise modal kapalı. */
  const [oddsFor, setOddsFor] = useState<PackDto | null>(null);
  /** Bakiyesi yetmeyen paket ve hangi keseyle denendiği; null ise kapalı. */
  const [shortFor, setShortFor] = useState<{ pack: PackDto; currency: Currency } | null>(null);

  /**
   * Coin bir ödeme seçeneği olarak sunulsun mu?
   *
   * Satın alma henüz kurulmadı (FEATURES.coinPurchase). Kapalıyken coin
   * yalnızca ELİNDE OLAN oyuncuya gösteriliyor: 0 coin ile "55 coin" düğmesi
   * göstermek, oyuncuyu elde etmenin yolu olmayan bir şeye yönlendirmek
   * olurdu. Geliştirme aracıyla coin yazıldığında akışın tamamı denenebiliyor.
   */
  const coinOffered = FEATURES.coinPurchase || coins > 0;

  useEffect(() => {
    let alive = true;
    storeApi
      .packs()
      .then((list) => alive && setPacks(list))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Bakiye kontrolü BURADA da var ama asıl kontrol sunucuda.
   *
   * Buradaki tek işi oyuncuya "yetmiyor" demeden önce paket açma ekranına
   * gidip orada hata göstermemek — yani bir kullanıcı deneyimi meselesi.
   * Güvenlik değil: istemci bu kontrolü atlasa da sunucu reddediyor.
   */
  function onBuy(pack: PackDto, currency: Currency) {
    const price = currency === 'coin' ? pack.price.coin : pack.price.rim;
    const balance = currency === 'coin' ? coins : rims;
    if (balance < price) {
      setShortFor({ pack, currency });
      return;
    }
    router.push({ pathname: '/pack-opening', params: { packId: pack.id, currency } });
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <View style={styles.crumbRow}>
        <Pressable style={styles.back} onPress={() => router.replace('/')}>
          <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textMuted} />
          <Text style={styles.backText}>Menü</Text>
        </Pressable>
        <WalletPill rims={rims} coins={coins} />
      </View>

      <Text style={styles.title}>Mağaza</Text>
      <Text style={styles.help} numberOfLines={2}>
        Paketten tek kart çıkar. Aradığın belli bir kart varsa Koleksiyon&apos;dan doğrudan da
        alabilirsin.
      </Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {packs === null && !failed && <ActivityIndicator style={styles.loading} color={colors.primary} />}

        {failed && (
          <View style={styles.offline}>
            <MaterialCommunityIcons name="wifi-off" size={22} color={colors.textMuted} />
            <Text style={styles.offlineText}>
              {connection === 'offline'
                ? 'Mağaza çevrimdışıyken açılmıyor — paket açmak sunucu gerektiriyor.'
                : 'Paketler yüklenemedi.'}
            </Text>
          </View>
        )}

        {packs?.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            coinOffered={coinOffered}
            onOdds={() => setOddsFor(pack)}
            onBuy={(currency) => onBuy(pack, currency)}
          />
        ))}

        {packs && packs.length > 0 && (
          <View style={styles.refundBanner}>
            <MaterialCommunityIcons name="autorenew" size={18} color={colors.accentDark} />
            <Text style={styles.refundText}>
              Sahip olduğun kart çıkarsa değerinin <Text style={styles.refundStrong}>%25&apos;i</Text>{' '}
              ödediğin keseye geri döner.
            </Text>
          </View>
        )}
      </ScrollView>

      <OddsModal pack={oddsFor} coinOffered={coinOffered} onClose={() => setOddsFor(null)} />
      <ShortOnFundsSheet
        short={shortFor}
        rims={rims}
        coins={coins}
        onClose={() => setShortFor(null)}
        onBattle={() => {
          setShortFor(null);
          router.replace('/');
        }}
      />
    </SafeAreaView>
  );
}

function PackCard({
  pack,
  coinOffered,
  onOdds,
  onBuy,
}: {
  pack: PackDto;
  coinOffered: boolean;
  onOdds: () => void;
  onBuy: (currency: Currency) => void;
}) {
  // Paketin "kimliği" en yüksek çekebildiği nadirlikten geliyor: Temel gri,
  // Nadir+ mor. Sunucu yeni bir paket eklerse rengi kendiliğinden oturur.
  const top = RARITY_ORDER.filter((r) => pack.odds[r] != null).pop() ?? 'common';
  const tint = rarityTheme[top];

  return (
    <View style={[styles.pack, { borderColor: tint.border }]}>
      <View style={[styles.packArt, { backgroundColor: tint.art }]}>
        <View style={styles.fan}>
          <View style={[styles.fanCard, styles.fanLeft, { borderColor: rarityTheme.common.border }]} />
          <View style={[styles.fanCard, styles.fanMid, { borderColor: tint.border }]} />
          <View style={[styles.fanCard, styles.fanRight, { borderColor: rarityTheme.rare.border }]} />
        </View>
      </View>

      <View style={styles.packBody}>
        <View style={{ gap: 2 }}>
          <Text style={styles.packName}>{pack.name}</Text>
          <Text style={styles.packBlurb}>{pack.blurb}</Text>
        </View>

        {/* Oran şeridi dokunulabilir: tek dokunuşta detay açılır, oyuncu
            mağazadan kopmaz. Özet burada kalıyor — oranların görünür olması
            hem dürüstlük hem mağaza politikası meselesi. */}
        <Pressable onPress={onOdds} hitSlop={6}>
          <View style={styles.oddsHeader}>
            <Text style={styles.oddsLabel}>ÇIKMA ORANLARI</Text>
            <View style={styles.oddsDetail}>
              <Text style={styles.oddsDetailText}>Detay</Text>
              <MaterialCommunityIcons name="chevron-right" size={15} color={colors.primaryInk} />
            </View>
          </View>
          <View style={styles.oddsRow}>
            {RARITY_ORDER.filter((r) => pack.odds[r] != null).map((r) => (
              <View key={r} style={[styles.oddsChip, { backgroundColor: rarityTheme[r].pill }]}>
                <Text style={[styles.oddsPct, { color: rarityTheme[r].ink }]}>%{pack.odds[r]}</Text>
                <Text style={[styles.oddsName, { color: rarityTheme[r].ink }]}>{rarityTheme[r].label}</Text>
              </View>
            ))}
          </View>
        </Pressable>

        {/* Jant asıl yol, o yüzden birincil düğme. Coin ikincil ve daha
            sessiz: aynı paketi para ödeyerek almanın yolu, tercih edilmesi
            beklenen yol değil. İkisi de AYNI kartı veriyor — para güç değil
            zaman satın alıyor. */}
        <ChunkyButton variant="primary" onPress={() => onBuy('rim')}>
          <View style={styles.buyInner}>
            <CurrencyTag currency="rim" amount={pack.price.rim} size={16} color="#FFFFFF" />
            <Text style={styles.buyLabel}>jant</Text>
          </View>
        </ChunkyButton>

        {coinOffered && pack.price.coin > 0 ? (
          <Pressable style={styles.coinBuy} onPress={() => onBuy('coin')}>
            <Text style={styles.coinBuyOr}>ya da</Text>
            <CurrencyTag currency="coin" amount={pack.price.coin} size={15} />
            <Text style={styles.coinBuyLabel}>coin</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function OddsModal({
  pack,
  coinOffered,
  onClose,
}: {
  pack: PackDto | null;
  coinOffered: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={pack !== null} onClose={onClose}>
      <>
        {pack && (
          <>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{pack.name}</Text>
              <View style={styles.priceRow}>
                <View style={styles.pricePill}>
                  <CurrencyTag currency="rim" amount={pack.price.rim} size={14} />
                </View>
                {coinOffered && pack.price.coin > 0 ? (
                  <View style={[styles.pricePill, { backgroundColor: colors.accentSoft }]}>
                    <CurrencyTag currency="coin" amount={pack.price.coin} size={14} />
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={styles.sheetHelp}>
              Tek kart çıkar. Oranlar her açılışta aynıdır — art arda açmak şansı değiştirmez.
            </Text>

            <View style={styles.bars}>
              {RARITY_ORDER.filter((r) => pack.odds[r] != null).map((r) => (
                <View key={r} style={{ gap: 5 }}>
                  <View style={styles.barHead}>
                    <Text style={[styles.barName, { color: rarityTheme[r].ink }]}>
                      {rarityTheme[r].label}
                    </Text>
                    <Text style={styles.barPct}>%{pack.odds[r]}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pack.odds[r] ?? 0}%`, backgroundColor: rarityTheme[r].border },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.refundBanner}>
              <MaterialCommunityIcons name="autorenew" size={17} color={colors.accentDark} />
              <Text style={styles.refundText}>
                Sahip olduğun kart çıkarsa değerinin{' '}
                <Text style={styles.refundStrong}>%25&apos;i</Text> ödediğin keseye geri döner.
                Örnek: nadir kart 600 jant → 150 jant iade.
              </Text>
            </View>

            <Text style={styles.footnote}>
              Hiçbir kart yalnızca paketten çıkmaz — hepsi Koleksiyon&apos;dan doğrudan da alınabilir.
            </Text>

            <ChunkyButton variant="secondary" label="Anladım" onPress={onClose} style={{ marginTop: space.md }} />
          </>
        )}
      </>
    </BottomSheet>
  );
}

/**
 * Bakiye yetmiyor sayfası — iki kese için de aynı sayfa ama farklı çıkış yolu.
 *
 * Jant eksikse yapılacak şey belli: maça gir, kazan. Coin eksikse maçın
 * faydası yok (maç jant veriyor), tek yol satın almak — ve satın alma henüz
 * kurulmadığı için oyuncuya bunu dürüstçe söylüyoruz. Aynı sayfada iki farklı
 * öneri vermek, oyuncuyu işe yaramayacak bir eyleme yönlendirmemenin yolu.
 */
function ShortOnFundsSheet({
  short,
  rims,
  coins,
  onClose,
  onBattle,
}: {
  short: { pack: PackDto; currency: Currency } | null;
  rims: number;
  coins: number;
  onClose: () => void;
  onBattle: () => void;
}) {
  const currency = short?.currency ?? 'rim';
  const meta = CURRENCY[currency];
  const unit = meta.label.toLowerCase();
  const price = short ? (currency === 'coin' ? short.pack.price.coin : short.pack.price.rim) : 0;
  const balance = currency === 'coin' ? coins : rims;
  const missing = price - balance;
  const pct = price > 0 ? Math.min(100, Math.round((balance / price) * 100)) : 0;

  return (
    <BottomSheet visible={short !== null} onClose={onClose}>
      <>
        {short && (
          <>
            <View style={styles.shortHead}>
              <View style={styles.shortIcon}>
                <MaterialCommunityIcons name={meta.icon} size={28} color={colors.accentDark} />
              </View>
              <Text style={styles.shortTitle}>
                {missing} {unit} eksik
              </Text>
              <Text style={styles.shortHelp}>
                {short.pack.name} {price} {unit}. Bakiyen {balance}.{' '}
                {currency === 'rim'
                  ? 'Maç kazandıkça jant biriktirirsin — kaybetsen de bir miktar kazanırsın.'
                  : 'Coin maçtan kazanılmıyor, yalnızca satın alınıyor. Aynı paketi jantla da açabilirsin.'}
              </Text>
            </View>

            <View style={styles.progressBox}>
              <View style={styles.barHead}>
                <Text style={styles.progressLabel}>{short.pack.name}&apos;e kalan</Text>
                <Text style={styles.progressValue}>
                  {balance} / {price}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>

            {currency === 'rim' ? (
              <ChunkyButton variant="accent" onPress={onBattle} style={{ marginTop: space.md }}>
                <View style={styles.buyInner}>
                  <MaterialCommunityIcons name="play" size={18} color={colors.ink} />
                  <Text style={styles.battleLabel}>Maça gir</Text>
                </View>
              </ChunkyButton>
            ) : (
              // Satın alma kurulmadan buraya yalnızca elinde bir miktar coin
              // olan oyuncu düşebiliyor (bkz. coinOffered). Uydurma bir
              // "yakında" düğmesi koymuyoruz: olmayan bir eylem sunmak yerine
              // durumu söylüyoruz.
              <View style={styles.soonBox}>
                <MaterialCommunityIcons name="information-outline" size={17} color={colors.primaryInk} />
                <Text style={styles.soonBoxText}>
                  {FEATURES.coinPurchase
                    ? 'Coin satın alma ekranı buradan açılacak.'
                    : 'Coin satın alma henüz açık değil.'}
                </Text>
              </View>
            )}
            <ChunkyButton
              variant="secondary"
              label="Vazgeç"
              onPress={onClose}
              style={{ marginTop: space.sm }}
            />
          </>
        )}
      </>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  crumbRow: {
    height: 34,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.textMuted },
  title: {
    fontFamily: font.heading,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    paddingHorizontal: space.md,
    marginTop: 10,
  },
  help: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textMuted,
    paddingHorizontal: space.md,
    marginTop: 2,
  },
  scroll: { padding: space.md, paddingBottom: NAV_CLEARANCE, gap: 14 },
  loading: { marginTop: space.xl },
  offline: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  offlineText: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },

  pack: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  packArt: { height: 104, alignItems: 'center', justifyContent: 'center' },
  fan: { flexDirection: 'row', alignItems: 'flex-end' },
  fanCard: { backgroundColor: colors.surface, borderWidth: 2, borderRadius: 8 },
  fanLeft: { width: 46, height: 62, transform: [{ rotate: '-14deg' }, { translateY: 4 }] },
  fanMid: { width: 50, height: 68, marginHorizontal: -10, zIndex: 1, ...shadow.card },
  fanRight: { width: 46, height: 62, transform: [{ rotate: '14deg' }, { translateY: 4 }] },
  packBody: { padding: 14, paddingTop: 12, gap: 10 },
  packName: { fontFamily: font.headingSm, fontSize: 18, lineHeight: 22, color: colors.ink },
  packBlurb: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textMuted,
  },

  oddsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  oddsLabel: {
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  oddsDetail: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  oddsDetailText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.primaryInk },
  oddsRow: { flexDirection: 'row', gap: 5 },
  oddsChip: { flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center' },
  oddsPct: { fontFamily: font.stat, fontSize: 15, lineHeight: 18 },
  oddsName: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, lineHeight: text.bodySmall.lineHeight },

  buyInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /** Coin satırı bilerek sessiz: aynı kartı veren ikinci yol, tercih
   *  edilmesi beklenen yol değil. */
  coinBuy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  coinBuyOr: { fontFamily: font.body, fontSize: text.bodySmall.fontSize, color: colors.textMuted },
  coinBuyLabel: { fontFamily: font.bodyBold, fontSize: text.body.fontSize, color: colors.accentDark },
  soonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: space.md,
    padding: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  soonBoxText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.ink,
  },
  buyLabel: { fontFamily: font.bodyBlack, fontSize: text.bodyBig.fontSize, color: '#FFFFFF' },
  battleLabel: { fontFamily: font.bodyBlack, fontSize: text.bodyBig.fontSize, color: colors.ink },

  refundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
  },
  refundText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.ink,
  },
  refundStrong: { fontFamily: font.bodyBlack },

  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: font.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  priceRow: { flexDirection: 'row', gap: 6 },
  pricePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.sunken,
  },
  sheetHelp: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: space.md,
  },
  bars: { gap: 11, marginBottom: space.md },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barName: { fontFamily: font.bodyBold, fontSize: text.body.fontSize },
  barPct: { fontFamily: font.stat, fontSize: 16, lineHeight: 20, color: colors.ink },
  barTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.sunken, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  footnote: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },

  shortHead: { alignItems: 'center', gap: 6 },
  shortIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortTitle: { fontFamily: font.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  shortHelp: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
  },
  progressBox: { marginTop: space.md, padding: 14, backgroundColor: colors.sunken, borderRadius: radius.md, gap: 9 },
  progressLabel: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.inkSoft },
  progressValue: { fontFamily: font.stat, fontSize: text.body.fontSize, color: colors.ink },
});
