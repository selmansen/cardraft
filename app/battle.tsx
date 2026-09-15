import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBattleMusic } from '@/audio/music';
import { playSfx, type SfxHandle } from '@/audio/sfx';
import { RarityStars } from '@/components/GameCard';
import { BOT_REPLIES, QUICK_MESSAGES } from '@/constants/messages';
import {
  colors,
  font,
  LONG_PRESS_MS,
  radius,
  rarity as RAR,
  shadow,
  space,
  text,
  type RarityKey,
} from '@/constants/theme';
import { carImage } from '@/data/carImages';
import { CLASS_LABEL, getCard } from '@/data/cards';
import { abilityDesc, abilityShort } from '@/game/abilities';
import {
  applyAction,
  BOARD_LIMIT,
  createBattle,
  legalSupportTargets,
  legalTargets,
  type BattleAction,
  type BattleState,
  type HandCard,
  type LoadoutEntry,
  type SideId,
  type SupportBattleCard,
  type Vehicle,
} from '@/game/battleEngine';
import { planBotTurn } from '@/game/bot';
import { makeBotLoadout, makeBotSupportLoadout } from '@/game/botDeck';
import { ChunkyButton } from '@/components/ChunkyButton';
import { useDialog } from '@/components/overlay/DialogProvider';
import { CurrencyTag } from '@/components/Currency';
import { MatchRecorder, openMatchSession, type MatchSetup } from '@/game/matchSession';
import { useSessionStore } from '@/store/sessionStore';
import { battleReward, DIFFICULTY } from '@/game/difficulty';
import { STAT_HINT } from '@/game/statLegend';
import { supportCardEffectText } from '@/game/supportAbilities';
import { LOADOUT_TOTAL, useGameStore } from '@/store/gameStore';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PLAY_THRESHOLD = -64;
const HC_W = 84;
const HC_H = 114;
const HAND_ROW_HEIGHT = 128; // expanded height of the hand drawer's card row
// How far each hand card steps from the one before it. The cards overlap, so
// the step is smaller than the card: at HAND_STEP_MAX five cards sit side by
// side comfortably, and a fuller hand squeezes the step down (never below
// HAND_STEP_MIN, where the fuel badge would start disappearing) so the fan
// always fits the screen instead of running off its right edge.
const HAND_STEP_MAX = 56;
// Eldeki yakıt rozeti, sahadaki rozetlerle aynı ölçüde değil: el kartı daha
// küçük ve üstünde tek rozet var, sahadaki 110 px'lik kartın 30 px'lik
// rozetini buraya taşımak kartın dörtte birini rozete veriyordu.
const HC_BADGE = Math.round(HC_W * 0.31);
const HAND_STEP_MIN = 30;

function handStep(count: number, screenWidth: number): number {
  if (count <= 1) return HAND_STEP_MAX;
  const fit = (screenWidth - space.md * 2 - HC_W) / (count - 1);
  return Math.max(HAND_STEP_MIN, Math.min(HAND_STEP_MAX, Math.floor(fit)));
}

// Board cards (not the hand) size themselves to the screen: always exactly 3
// per row. They stay inside the same side padding as everything else (never
// past the safe area) — no edge-to-edge trick here.
const BOARD_CARDS_PER_ROW = 3;
const BOARD_CARD_GAP = 10;
const BOARD_CARD_ASPECT = 122 / 92; // height/width, matches the original card proportions
const BOARD_CARD_MIN_W = 84;
const BOARD_CARD_MAX_W = 132; // clamp so a tablet/huge phone doesn't blow the cards up

function boardCardSize(screenWidth: number): { width: number; height: number } {
  const raw =
    (screenWidth - space.md * 2 - BOARD_CARD_GAP * (BOARD_CARDS_PER_ROW - 1)) /
    BOARD_CARDS_PER_ROW;
  // floor, not round: rounding a fractional width UP by even half a pixel
  // across 3 cards + 2 gaps was occasionally enough to exceed the row's
  // actual available width, which is exactly what made only 2 fit before
  // wrapping instead of 3 on some screen widths.
  const width = Math.floor(Math.min(BOARD_CARD_MAX_W, Math.max(BOARD_CARD_MIN_W, raw)));
  const height = Math.round(width * BOARD_CARD_ASPECT);
  return { width, height };
}

/**
 * Kart durumu kenarda DEĞİL, kartın dışındaki halkada gösteriliyor.
 *
 * Kenar artık kalıcı olarak nadirliğin rengi — oyuncu koleksiyonda ne
 * görüyorsa savaşta da onu görüyor, "elimde destansı var" diyebiliyor.
 * "Şu an ne yapabilirsin" bilgisi ise dış halkada duruyor ve yeşil savaş
 * ekranının her yerinde aynı şeyi söylüyor: elde "bunu oynayabilirsin",
 * sahada "bu araç saldırabilir".
 *
 * Soluklaştırma yok: soluk kart bozuk/yükleniyor gibi okunuyor, üstelik
 * nadirlik rengini de söndürüyordu. Oynanamayan karta dokunulduğunda zaten
 * nedenini söyleyen bir uyarı çıkıyor.
 */
const READY_RING = colors.success; // oynanabilir / saldırabilir
const ARMED_RING = colors.primary; // bırakılırsa oynanacak / sürükleniyor
const TARGET_RING = colors.danger; // sürüklenen kartın geçerli hedefi

// Arena proportions. The table is an ellipse wider than the screen, so its
// left/right edges are always off-screen and only the top/bottom curves show
// — that's what keeps it looking right at any width without a fixed-ratio
// image to letterbox or crop.
const TABLE_WIDTH_RATIO = 1.55; // × screen width
const TABLE_HEIGHT_RATIO = 0.72; // × screen height
// Where the two halves meet. Deliberately above the screen's midpoint: the
// board's own centre line sits high, because the header takes very little
// room at the top while the hand drawer takes a lot at the bottom. Splitting
// at a true 50% would put the seam inside the player's own board.
const ARENA_SPLIT_RATIO = 0.44;
/** Nudge, in points, applied on top of that ratio — the whole pitch (seam,
 *  table, markings) and the board content below the header shift down by
 *  this much together, so the balance between the two halves is tuned in one
 *  place instead of drifting apart. */
const ARENA_DROP = 15;
function arenaSeam(height: number): number {
  return height * ARENA_SPLIT_RATIO + ARENA_DROP;
}
// One thickness for every white line on the arena — the table's rim, the
// centre line and the centre circle. Keeping them equal is what makes the
// markings read as one set of pitch lines instead of three unrelated strokes.
const ARENA_RIM = 10;
const ARENA_LINE = 'rgba(255,255,255,0.8)';

interface InspectData {
  cardId: string;
  name: string;
  attack: number;
  speed: number;
  health: number;
  maxHealth: number;
  cost: number;
}

type ToastKind = 'info' | 'success' | 'error';
/** Orange = here's some info, green = good outcome, red = that didn't work. */
const TOAST_STYLE: Record<ToastKind, { bg: string; fg: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  info: { bg: colors.accent, fg: colors.ink, icon: 'information' },
  success: { bg: colors.successInk, fg: '#FFFFFF', icon: 'check-circle' },
  error: { bg: colors.dangerInk, fg: '#FFFFFF', icon: 'alert-circle' },
};

/** One unified announcement queue: every "SIRA SENDE"/"RAKİP OYNUYOR" turn
 *  change AND every combat-log/rejection message now goes through the same
 *  sweep-in/hold/sweep-out presentation, one at a time, with the board
 *  blurred and untouchable while any of it is playing — no more two
 *  different info boxes competing for attention at once. */
type SweepItem =
  // `id` is what keys the component. Keying by content instead meant two
  // identical messages in a row (the bot hitting for the same damage twice,
  // say) reused the same mounted InfoSweep — so the second one inherited
  // whatever was left of the first one's timer and vanished early.
  | { id: number; type: 'turn'; side: SideId; turn: number }
  // `side`, when present, is whose action this reports (an attack/ability log
  // line) — it colors the bar the same primary/accent pair as the turn
  // banner (your move vs. the opponent's) instead of the flat kind-based
  // tone, so a busy combat log doesn't read as one endless orange smear.
  | { id: number; type: 'text'; text: string; kind: ToastKind; side?: SideId };

/** A window-absolute rectangle for hit-testing where a dragged card was dropped. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A one-shot impact burst — 'garage' hits get a bigger, redder effect than
 *  a vehicle-vs-vehicle trade. */
interface Impact {
  id: number;
  x: number;
  y: number;
  kind: 'vehicle' | 'garage';
}

function hpColor(pct: number) {
  return pct > 33 ? colors.success : colors.danger;
}
function rarOf(cardId: string) {
  return RAR[getCard(cardId).rarity];
}

/** Nadirlik şeridinin üstündeki mürekkep. Tasarım sisteminin kuralı:
 *  turuncu ve açık dolguların üstüne KOYU, koyu dolguların üstüne beyaz —
 *  destansı (turuncu) ve sıradan (açık gri) üzerinde beyaz 4.5:1'in altında
 *  kalıyor. GameCard'daki tik rengiyle aynı karar. */
function rarityInk(key: RarityKey): string {
  return key === 'legendary' || key === 'common' ? colors.ink : '#FFFFFF';
}

/**
 * Yuvarlak stat rozeti: ikon rozetin TAMAMINI dolduran bir filigran, rakam
 * onun üstünde gölgeli.
 *
 * Savaş kartında ikonla rakamı yan yana koyacak yer yok — 30 px'lik bir
 * rozette ikon küçülünce de okunmuyordu. Üst üste koyunca ikon dokuya
 * dönüşüyor, rakam tam boy kalıyor ve renk (güç turuncu, hız mavi,
 * dayanıklılık yeşil, yakıt lacivert) kart detay sayfasındakiyle birebir
 * aynı oluyor. Gölge, parlak dolgu üzerindeki beyaz rakamı okunur tutuyor.
 */
function StatBadge({
  icon,
  tint,
  value,
  size,
  ring,
  markInset,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  value: number | string;
  size: number;
  /** Sağlık rozetinde "az kaldı" uyarısı — dolgu rengi stat kimliği olduğu
   *  için değişmiyor, uyarı ince bir çerçeveyle veriliyor. */
  ring?: string;
  /** Filigranı rozetin kenarından bu kadar içeride tutar. Kalkan ikonu, diğer
   *  ikonların aksine kendi kutusunu tamamen dolduruyor — boşluksuz
   *  bırakıldığında rozet daire değil, düz bir kalkan lekesi gibi okunuyor. */
  markInset?: number;
}) {
  // İki katman: gölge dışta, kırpma içte. iOS'ta aynı View'de hem
  // overflow:'hidden' hem gölge olunca gölge çizilmiyor — filigran ikonun
  // daireye kırpılması da şart, o yüzden ikisi ayrıldı.
  return (
    <View style={[styles.statBadgeShadow, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        style={[
          styles.statBadge,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
          ring ? { borderWidth: 2, borderColor: ring } : null,
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={markInset ? Math.round(size - markInset * 2) : Math.round(size * 1.05)}
          color="#FFFFFF"
          style={styles.statBadgeMark}
        />
        <Text style={[styles.statBadgeText, { fontSize: Math.round(size * 0.5) }]}>{value}</Text>
      </View>
    </View>
  );
}

/** Kartın üstündeki ad şeridi — zemini nadirliğin rengi, altında yıldızları.
 *  Hem eldeki hem sahadaki kartta aynı; nadirliği savaş boyunca görünür
 *  tutan asıl şey bu şerit. */
function CardNameBar({ cardId, name, fontSize }: { cardId: string; name: string; fontSize: number }) {
  const key = getCard(cardId).rarity;
  const r = RAR[key];
  const ink = rarityInk(key);
  return (
    <View style={[styles.nameBar, { backgroundColor: r.border }]}>
      <Text style={[styles.nameBarText, { color: ink, fontSize }]} numberOfLines={1}>
        {name}
      </Text>
      <RarityStars count={r.stars} color={ink} size={8} />
    </View>
  );
}

/** "Just got hit" feedback for a card or garage bar: a quick shake + red
 *  flash, driven by a per-target token so only the card that was actually
 *  attacked pulses — bumping it on mount is skipped so cards don't flash
 *  the instant they're first laid out. */
function useHitPulse(hitToken: number) {
  const shakeX = useSharedValue(0);
  const flash = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    shakeX.value = withSequence(
      withTiming(-6, { duration: 40 }),
      withTiming(6, { duration: 70 }),
      withTiming(-4, { duration: 70 }),
      withTiming(0, { duration: 70 }),
    );
    flash.value = withSequence(withTiming(0.55, { duration: 50 }), withTiming(0, { duration: 260 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitToken]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  return { shakeStyle, flashStyle };
}

/** "Here's what you actually need to hit" — a quick forward pop (scale
 *  bounce) on a blocker when the player's drop was rejected for standing
 *  behind one, so the rejection reads as "hit THIS one" instead of just an
 *  error toast. Same skip-on-mount guard as useHitPulse. */
function useEmphasisPulse(token: number) {
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.value = withSequence(
      withTiming(1.14, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // zIndex rides along with the scale itself (not a separate boolean flag),
  // so the card only actually paints above its neighbors while it's visibly
  // popped up — never left elevated after the animation settles back to 1.
  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    zIndex: scale.value > 1.001 ? 20 : 0,
  }));
}

/**
 * A board card's arrival. Two flavours:
 *
 * `dramatic` (your own cards): the card blows up to SPAWN_SCALE in the middle
 * of the screen, holds there for a beat so you actually read what you just
 * played, then shrinks down into its slot. `shiftX` is what carries it to
 * screen centre and back — a card in an outer slot would otherwise blow up
 * straight off the side of the screen at 3x.
 *
 * Plain (the opponent's): a quick oversized settle, no hold. The bot can play
 * a card every turn and a 1.7s ceremony each time would stall its whole turn.
 *
 * Runs on mount and only on mount, which is exactly right: a board card is
 * keyed by uid, so it mounts when (and only when) a vehicle reaches the
 * board — including the newcomer in a scrap swap. Nothing starts until the
 * card has been measured, so the very first frame already knows where centre
 * screen is instead of jumping there a frame later.
 *
 * Returns the elevation separately from the transform because the two have to
 * go on different views: zIndex only orders siblings, and the animated view
 * is an only child of the wrapper that measures the card. Transform goes on
 * the inner view (so measurement stays untransformed and drop targets keep
 * their real coordinates), elevation on the outer one (so the oversized card
 * paints over its neighbours).
 */
const SPAWN_SCALE = 2.3;
const SPAWN_GROW_MS = 320;
const SPAWN_HOLD_MS = 1000;
const SPAWN_SETTLE_MS = 420;
const SPAWN_TOTAL_MS = SPAWN_GROW_MS + SPAWN_HOLD_MS + SPAWN_SETTLE_MS;

function useSpawnDrop(dramatic: boolean): {
  style: ReturnType<typeof useAnimatedStyle>;
  elevated: boolean;
  onMeasured: (centreX: number, centreY: number) => void;
} {
  // 0 = in the slot at rest, 1 = held big at screen centre, 2 = back home.
  const p = useSharedValue(0);
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const started = useRef(false);
  const [elevated, setElevated] = useState(true);
  const { width: screenW } = useWindowDimensions();

  const onMeasured = useCallback(
    (centreX: number, centreY: number) => {
      if (started.current) return;
      started.current = true;
      if (dramatic) {
        shiftX.value = screenW / 2 - centreX;
        // Only a nudge vertically: the card is already near the middle band
        // of the screen, and hauling it to the exact centre would cover the
        // garage bars for the whole hold.
        shiftY.value = 0;
      }
      const total = dramatic ? SPAWN_TOTAL_MS : 380;
      p.value = dramatic
        ? withSequence(
          withTiming(1, { duration: SPAWN_GROW_MS, easing: Easing.out(Easing.cubic) }),
          withDelay(
            SPAWN_HOLD_MS,
            withTiming(2, { duration: SPAWN_SETTLE_MS, easing: Easing.inOut(Easing.cubic) }),
          ),
        )
        : withTiming(2, { duration: total, easing: Easing.out(Easing.cubic) });
      setTimeout(() => setElevated(false), total + 40);
    },
    [dramatic, p, screenW, shiftX, shiftY],
  );

  // No fade-in: the card is fully opaque from the first frame. Fading it up
  // left a beat where the hand card was already gone and the board card
  // wasn't visible yet, which read as the card briefly vanishing.
  const style = useAnimatedStyle(() => {
    const peak = dramatic ? SPAWN_SCALE : 1.55;
    return {
      transform: [
        { translateX: interpolate(p.value, [0, 1, 2], [0, shiftX.value, 0], Extrapolation.CLAMP) },
        { translateY: interpolate(p.value, [0, 1, 2], [0, shiftY.value, 0], Extrapolation.CLAMP) },
        { scale: interpolate(p.value, [0, 1, 2], [1, peak, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  return { style, elevated, onMeasured };
}

/**
 * The entrance a rare+ card gets on top of the normal arrival: a ring of its
 * own rarity colour blows outward while the card is held big, with sparks
 * thrown off around it. Legendary/epic throw more, further and bigger, so the
 * rarity ladder is legible from the animation alone without a label.
 *
 * Timed to fire as the card reaches full size (just under SPAWN_GROW_MS) and
 * finish inside the hold, so it plays while the card is stationary and big
 * rather than competing with the movement.
 */
function SpawnAura({
  tint,
  size,
  sparks,
}: {
  tint: string;
  size: { width: number; height: number };
  sparks: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      SPAWN_GROW_MS - 60,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
  }, [p]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [0.7, 1.9], Extrapolation.CLAMP) }],
    opacity: interpolate(p.value, [0, 0.12, 1], [0, 0.9, 0], Extrapolation.CLAMP),
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.12, 0.6, 1], [0, 0.45, 0.2, 0], Extrapolation.CLAMP),
  }));

  const ring = Math.max(size.width, size.height) * 0.92;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.auraGlow,
          { backgroundColor: tint, borderRadius: ring / 2, marginLeft: -ring / 2, marginTop: -ring / 2, width: ring, height: ring },
          glowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.auraRing,
          { borderColor: tint, borderRadius: ring / 2, marginLeft: -ring / 2, marginTop: -ring / 2, width: ring, height: ring },
          ringStyle,
        ]}
      />
      {Array.from({ length: sparks }, (_, i) => (
        <AuraSpark
          key={i}
          p={p}
          tint={tint}
          angle={(i / sparks) * Math.PI * 2 + (i % 2 ? 0.4 : 0)}
          distance={size.width * (i % 2 ? 0.95 : 0.72)}
        />
      ))}
    </View>
  );
}

function AuraSpark({
  p,
  tint,
  angle,
  distance,
}: {
  p: SharedValue<number>;
  tint: string;
  angle: number;
  distance: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const d = interpolate(t, [0, 1], [0, distance], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d },
        { scale: interpolate(t, [0, 0.2, 1], [0.3, 1, 0.15], Extrapolation.CLAMP) },
        { rotate: `${t * 200}deg` },
      ],
      opacity: interpolate(t, [0, 0.12, 0.7, 1], [0, 1, 0.9, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[styles.auraSpark, style]}>
      <MaterialCommunityIcons name="star-four-points" size={14} color={tint} />
    </Animated.View>
  );
}

/** How loud a card's arrival burst is — nothing for a common, more and
 *  further-thrown sparks the rarer it gets. */
function spawnSparkCount(r: RarityKey): number {
  if (r === 'legendary') return 12;
  if (r === 'epic') return 9;
  if (r === 'rare') return 6;
  return 0;
}

function inspectFromVehicle(v: Vehicle): InspectData {
  return {
    cardId: v.cardId,
    name: v.name,
    attack: v.attack + v.tempAttack,
    speed: v.speed,
    health: v.health,
    maxHealth: v.maxHealth,
    cost: v.cost,
  };
}

export default function BattleScreen() {
  useBattleMusic();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardSize = useMemo(() => boardCardSize(screenWidth), [screenWidth]);
  const loadout = useGameStore((s) => s.loadout);
  const supportLoadout = useGameStore((s) => s.supportLoadout);
  const battlesWon = useGameStore((s) => s.battlesWon);
  const difficulty = useGameStore((s) => s.difficulty);
  const recordBattle = useGameStore((s) => s.recordBattle);
  const soundOn = useGameStore((s) => s.soundOn);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const autoEndTurn = useGameStore((s) => s.autoEndTurn);
  const toggleAutoEndTurn = useGameStore((s) => s.toggleAutoEndTurn);
  const preset = DIFFICULTY[difficulty];

  const playerLoadout = useMemo<LoadoutEntry[]>(
    // Kart seviyesi yok artık: kadro sadece kimliklerden ibaret.
    () => loadout.map((id) => ({ cardId: id })),
    [loadout],
  );

  const [battle, setBattle] = useState<BattleState | null>(null);
  /**
   * Sunucudaki maç oturumu ve oyuncunun hamle kaydı.
   *
   * Ref, state değil: ikisi de render'ı etkilemiyor ve her hamlede state
   * güncellemek gereksiz render zinciri doğururdu. `session.matchId === null`
   * çevrimdışı oynandığı anlamına geliyor — o maç ödül vermiyor.
   */
  const session = useRef<MatchSetup | null>(null);
  const recorder = useRef(new MatchRecorder());
  const [offlineMatch, setOfflineMatch] = useState(false);
  const [serverReward, setServerReward] = useState<number | null>(null);
  /**
   * Misafirin kaçırdığı ödül.
   *
   * Sunucu misafire 0 yazıyor (ADR 0016), dolayısıyla `serverReward`
   * kullanılamaz — burada paylaşılan motorun formülü kullanılıyor, yani
   * sunucunun hesap yapacağı formülün birebir aynısı. "Giriş yapsaydın X
   * kazanacaktın" cümlesinin doğru olmasının tek yolu bu.
   */
  const missedReward = battle?.winner
    ? battleReward(battle.winner === 'player', difficulty)
    : 0;
  const refreshWallet = useSessionStore((s) => s.refreshWallet);
  const dialog = useDialog();
  const isGuest = useSessionStore((s) => s.user?.isGuest ?? true);
  const guestOfferDismissed = useGameStore((s) => s.guestOfferDismissed);
  const dismissGuestOffer = useGameStore((s) => s.dismissGuestOffer);

  /**
   * Oyuncunun her hamlesi ÖNCE kaydediliyor, sonra uygulanıyor. Tek bir
   * yardımcıdan geçmesinin sebebi: beş ayrı çağrı noktası var (kart oynama,
   * feda takası, destek kartı, garaja saldırı, araca saldırı) ve birinde
   * kaydı unutmak, sunucunun maçı eksik oynatmasına ve sonucun ayrışmasına
   * yol açardı — sessizce, sadece o hamlenin yapıldığı maçlarda.
   */
  const applyPlayer = useCallback((state: BattleState, action: BattleAction): BattleState => {
    recorder.current.record(action);
    return applyAction(state, action);
  }, []);
  // The attacker currently mid-drag (also drives the red/green/black border
  // states and the full-screen "attack mode" dim — set at drag-start, cleared
  // at drop).
  const [selected, setSelected] = useState<string | null>(null);
  const [dragVehicle, setDragVehicle] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  // The one active announcement (see SweepItem above) — chat messages are a
  // separate, non-blocking system (top-left bubble), everything else about
  // "what's happening in the match" funnels through this single queue.
  const [activeSweep, setActiveSweep] = useState<SweepItem | null>(null);
  // "You drew this" reveal — the freshly-drawn card pops up big, then shrinks
  // away down toward the hand. Skipped for the opening deal (3 cards at
  // once reads oddly one at a time) and for the bot (its hand isn't shown).
  const [drawReveal, setDrawReveal] = useState<{ key: number; card: HandCard } | null>(null);
  // Destroyed vehicles pile up per side — battleEngine doesn't track this
  // (no reason to make the pure engine bigger for what's purely a visual
  // scrapbook), so it's reconstructed here by diffing each board against
  // the uids it held last render. A dead uid's info is already gone from
  // battle.*.board by the time this fires, hence stashing it as it's seen.
  const [deadCards, setDeadCards] = useState<{
    bot: { cardId: string; name: string }[];
    player: { cardId: string; name: string }[];
  }>({ bot: [], player: [] });
  const [graveyardOpen, setGraveyardOpen] = useState<'bot' | 'player' | null>(null);
  const seenBotBoard = useRef<Record<string, { cardId: string; name: string }>>({});
  const seenPlayerBoard = useRef<Record<string, { cardId: string; name: string }>>({});
  const [chatToast, setChatToast] = useState<{ text: string; mine: boolean } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  // The contextual hint + the auto-end-turn switch, both behind "Yardım Et"
  // now instead of parked on screen for the whole match.
  const [helpOpen, setHelpOpen] = useState(false);
  // Long-press on any card (hand or board) shows what it actually does —
  // enriched like the card detail page (art, stats, abilities).
  const [inspect, setInspect] = useState<InspectData | null>(null);
  const [supportInspect, setSupportInspect] = useState<SupportBattleCard | null>(null);
  // Hand is a drawer: tap the grabber to fold the card row away.
  const [handCollapsed, setHandCollapsed] = useState(false);
  const handRowHeight = useSharedValue(HAND_ROW_HEIGHT);
  useEffect(() => {
    handRowHeight.value = withTiming(handCollapsed ? 0 : HAND_ROW_HEIGHT, { duration: 220 });
  }, [handCollapsed, handRowHeight]);
  const handRowAnimStyle = useAnimatedStyle(() => ({ height: handRowHeight.value }));

  // The drawer's real height, measured, and used as the board's bottom
  // padding. High-water mark on purpose — it only ever grows: folding the
  // drawer away shrinks it by the whole card row, and now that there's no
  // scroll view absorbing that, a shrinking padding reflows the board above
  // it and the whole thing visibly jumps every time the drawer is toggled.
  const [handHeight, setHandHeight] = useState(HAND_ROW_HEIGHT + 64);
  const onHandLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHandHeight((prev) => (h > prev + 1 ? h : prev));
  }, []);

  // The card row is clipped so the fold animation looks clean — but a card
  // dragged up out of the hand must NOT be clipped, so the clip is only on
  // while the drawer is collapsed or mid-animation, never once it's settled.
  const [handClipped, setHandClipped] = useState(false);
  useEffect(() => {
    setHandClipped(true);
    if (handCollapsed) return;
    const t = setTimeout(() => setHandClipped(false), 240);
    return () => clearTimeout(t);
  }, [handCollapsed]);

  // Queued rather than replaced: a new item while one's still showing used to
  // snap it away instantly, so a busy bot turn (several log lines a second
  // apart) meant only the last one was ever actually readable. Now each
  // waits its turn, plays the full sweep in/hold/out, then the next starts.
  const [sweepQueue, setSweepQueue] = useState<SweepItem[]>([]);
  const sweepId = useRef(0);
  const toast = useCallback((text: string, kind: ToastKind = 'info', side?: SideId) => {
    sweepId.current += 1;
    setSweepQueue((q) => [...q, { id: sweepId.current, type: 'text', text, kind, side }]);
  }, []);
  // Stable identity matters: InfoSweep starts its animation from this, and a
  // new function each render would restart it on every render.
  const dismissSweep = useCallback(() => setActiveSweep(null), []);
  // A card arriving on the board owns the screen for the length of its
  // animation: entry-ability messages ("Nitro!", "Egzoz patlaması...") are
  // queued the same instant the card lands, and without this the blur came
  // up over the top of the card while it was still growing.
  const [spawnBusy, setSpawnBusy] = useState(false);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which side is mid-spawn, so that side's zone can be lifted over the
  // other one: an oversized card grows past its own board row into the
  // opponent's half, and sibling order alone put the player's zone (later in
  // the tree) on top of a bot card blowing up.
  const [spawnSide, setSpawnSide] = useState<SideId | null>(null);
  const holdForSpawn = useCallback((side: SideId) => {
    setSpawnBusy(true);
    setSpawnSide(side);
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    spawnTimer.current = setTimeout(() => {
      setSpawnBusy(false);
      setSpawnSide(null);
    }, SPAWN_TOTAL_MS);
  }, []);
  useEffect(() => () => (spawnTimer.current ? clearTimeout(spawnTimer.current) : undefined), []);

  useEffect(() => {
    if (activeSweep || spawnBusy || sweepQueue.length === 0) return;
    setActiveSweep(sweepQueue[0]);
    setSweepQueue((q) => q.slice(1));
  }, [activeSweep, spawnBusy, sweepQueue]);
  // Something is either playing right now or waiting its turn — the board
  // stays blurred and untouchable the whole time, not just between items.
  // A queued item held back by a spawn doesn't blur anything yet.
  const uiLocked = activeSweep !== null || (sweepQueue.length > 0 && !spawnBusy);
  const lockOpacity = useSharedValue(0);
  useEffect(() => {
    lockOpacity.value = withTiming(uiLocked ? 1 : 0, { duration: uiLocked ? 150 : 450 });
  }, [uiLocked, lockOpacity]);
  const lockOverlayStyle = useAnimatedStyle(() => ({ opacity: lockOpacity.value }));
  // The active InfoSweep registers its own hold/release here so the
  // full-screen lock overlay (rendered out here in BattleScreen, not inside
  // InfoSweep) can pause it from anywhere on screen, not just the bar itself.
  const sweepPauseRef = useRef<{ hold: () => void; release: () => void } | null>(null);
  const recorded = useRef(false);
  const battleRef = useRef<BattleState | null>(null);
  const chatTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  battleRef.current = battle;
  // Tracks "the screen is busy", which is the lock OR a spawn animation —
  // the bot loop has to sit through both, even though only the lock blurs.
  const uiLockedRef = useRef(false);
  uiLockedRef.current = uiLocked || spawnBusy;
  // Lets an async flow (endTurn's bot loop, the draw-reveal trigger) pace
  // itself against the announcement queue instead of guessing with sleeps:
  // wait for the lock to actually engage (something was just queued), then
  // wait for it to fully release (that something finished playing).
  const waitForSweepIdle = useCallback(async () => {
    const start = Date.now();
    while (!uiLockedRef.current && Date.now() - start < 300) {
      await sleep(30);
    }
    while (uiLockedRef.current) {
      await sleep(60);
    }
  }, []);

  // Window-absolute rects of enemy drop targets ('garage' + each bot vehicle
  // uid), refreshed on layout — used to hit-test where a dragged card lands.
  const dropRects = useRef<Record<string, Rect>>({});
  const registerDropRect = useCallback((id: string, r: Rect) => {
    dropRects.current[id] = r;
  }, []);
  // A dead vehicle's card unmounts and stops updating its rect, but the last
  // one it ever reported stayed in this map forever — nothing deleted it. If
  // the board later reflows into a similar layout, that stale rect could sit
  // right where a live vehicle (e.g. the blocker you're trying to hit) now
  // is, and hitTest() would match the dead uid first and reject the drop.
  // Pruning on every state change keeps the map limited to what can actually
  // be hit right now.
  // Scrolling moves every drop target's window-absolute position, so their
  // measured rects go stale — this tick tells the targets to re-measure
  // (throttled via scrollEventThrottle, not a per-frame remeasure). It also
  // gets bumped below on every battle change, not just scroll — see why there.
  const [scrollTick, setScrollTick] = useState(0);

  useEffect(() => {
    if (!battle) return;
    const valid = new Set([
      'garage',
      'playerGarage',
      ...battle.bot.board.map((v) => v.uid),
      ...battle.player.board.map((v) => v.uid),
    ]);
    for (const key of Object.keys(dropRects.current)) {
      if (!valid.has(key)) delete dropRects.current[key];
    }
    // A kill (or a new deploy) can reflow the whole row — the surviving
    // cards' onLayout eventually fires with their new position, but there's
    // a brief window right after the state update where dropRects still
    // holds their PRE-reflow rect. A fast second attack landing in that
    // window would hit-test against a stale rect and read as "dropped on
    // nothing" even though it was visually right on the target. Forcing an
    // immediate re-measure here (same mechanism scrolling already uses)
    // closes that window instead of waiting on layout timing.
    setScrollTick((t) => t + 1);
  }, [battle]);

  // Graveyard: whoever was on a board last render but isn't any more died —
  // stash it before overwriting the "last seen" snapshot with this render's.
  useEffect(() => {
    if (!battle) return;
    const nowBot: Record<string, { cardId: string; name: string }> = {};
    for (const v of battle.bot.board) nowBot[v.uid] = { cardId: v.cardId, name: v.name };
    const diedBot = Object.entries(seenBotBoard.current)
      .filter(([uid]) => !nowBot[uid])
      .map(([, info]) => info);
    seenBotBoard.current = nowBot;

    const nowPlayer: Record<string, { cardId: string; name: string }> = {};
    for (const v of battle.player.board) nowPlayer[v.uid] = { cardId: v.cardId, name: v.name };
    const diedPlayer = Object.entries(seenPlayerBoard.current)
      .filter(([uid]) => !nowPlayer[uid])
      .map(([, info]) => info);
    seenPlayerBoard.current = nowPlayer;

    if (diedBot.length > 0 || diedPlayer.length > 0) {
      setDeadCards((d) => ({ bot: [...d.bot, ...diedBot], player: [...d.player, ...diedPlayer] }));
    }
  }, [battle]);

  // Impact effects: a one-shot burst spawned at the exact point of a landed
  // attack (either side). Unlike the old dim/ghost overlays these don't need
  // to track a live position — they're born, animate ~400ms, and unmount —
  // so a stale coordinate from a scroll mid-animation is a non-issue.
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const impactSeq = useRef(0);
  const spawnImpact = useCallback((x: number, y: number, kind: Impact['kind']) => {
    const id = ++impactSeq.current;
    setImpacts((prev) => [...prev, { id, x, y, kind }]);
  }, []);
  const removeImpact = useCallback((id: number) => {
    setImpacts((prev) => prev.filter((i) => i.id !== id));
  }, []);
  // Per-target "just got hit" pulse (shake + red flash), keyed by the same id
  // used in dropRects (a vehicle uid, 'garage', or 'playerGarage') — bumping
  // only that target's counter means only its card re-triggers the effect.
  const [hitTokens, setHitTokens] = useState<Record<string, number>>({});
  const bumpHit = useCallback((id: string) => {
    setHitTokens((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);
  // Same per-target token pattern, but for "here's what you actually need to
  // hit" — a brief forward pop on the real blocker(s) when a drop is
  // rejected for standing behind one.
  const [highlightTokens, setHighlightTokens] = useState<Record<string, number>>({});
  const emphasizeBlockers = useCallback((uids: string[]) => {
    setHighlightTokens((prev) => {
      const next = { ...prev };
      for (const id of uids) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
  }, []);
  // Whole-screen "you felt that" sell: a quick camera jolt plus a warm flash,
  // layered on top of the local burst so a hit reads as a real collision
  // rather than a sprite popping up somewhere on the board.
  const screenShakeX = useSharedValue(0);
  const screenFlash = useSharedValue(0);
  const shakeScreen = useCallback(
    (strength: number) => {
      screenShakeX.value = withSequence(
        withTiming(-strength, { duration: 35 }),
        withTiming(strength, { duration: 55 }),
        withTiming(-strength * 0.6, { duration: 55 }),
        withTiming(strength * 0.3, { duration: 55 }),
        withTiming(0, { duration: 60 }),
      );
    },
    [screenShakeX],
  );
  const flashScreen = useCallback(
    (peak: number) => {
      screenFlash.value = withSequence(withTiming(peak, { duration: 40 }), withTiming(0, { duration: 200 }));
    },
    [screenFlash],
  );
  const screenShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: screenShakeX.value }] }));
  const screenFlashStyle = useAnimatedStyle(() => ({ opacity: screenFlash.value }));

  /** Fires the local burst, the target's shake, and the whole-screen sell
   *  for a landed attack — garage hits get the bigger version of all three. */
  const playImpact = useCallback(
    (id: string, kind: Impact['kind']) => {
      const r = dropRects.current[id];
      if (r) spawnImpact(r.x + r.w / 2, r.y + r.h / 2, kind);
      bumpHit(id);
      shakeScreen(kind === 'garage' ? 9 : 4.5);
      flashScreen(kind === 'garage' ? 0.4 : 0.22);
      playSfx(kind === 'garage' ? 'impact' : 'clank');
    },
    [spawnImpact, bumpHit, shakeScreen, flashScreen],
  );

  // Shared drag position: the dragged card's ghost (rendered above the dim)
  // follows the finger using these, updated entirely on the UI thread.
  const dragOriginX = useSharedValue(0);
  const dragOriginY = useSharedValue(0);
  const dragTx = useSharedValue(0);
  const dragTy = useSharedValue(0);

  // The win/lose clip is long enough to still be playing when the result
  // modal gets dismissed — createAudioPlayer() doesn't auto-stop on its own
  // the way a hook-managed player would, so whichever button closes the
  // modal (Tekrar Oyna or Menü) needs to explicitly cut it off.
  const resultSfx = useRef<SfxHandle | null>(null);
  const stopResultSfx = useCallback(() => {
    resultSfx.current?.stop();
    resultSfx.current = null;
  }, []);
  useEffect(() => () => stopResultSfx(), [stopResultSfx]);

  const newBattle = useCallback(async () => {
    stopResultSfx();
    recorded.current = false;
    setSelected(null);
    setDragVehicle(null);
    setBusy(false);
    setActiveSweep(null);
    setSweepQueue([]);
    setChatToast(null);
    setChatOpen(false);
    setHandCollapsed(false);
    setDeadCards({ bot: [], player: [] });
    setGraveyardOpen(null);
    setServerReward(null);
    seenBotBoard.current = {};
    seenPlayerBoard.current = {};
    recorder.current = new MatchRecorder();

    /**
     * Maç kurulumu artık SUNUCUDAN geliyor: tohum, bot destesi ve zorluk
     * ayarları. Tohumun sunucudan gelmesi kritik — istemci kendi tohumunu
     * seçebilseydi, kazandığı bir tohum bulana kadar deneyip onu oynardı.
     *
     * Sunucuya ulaşılamazsa oyun yerel kurulumla oynanır ama ÖDÜL VERMEZ:
     * doğrulanamayan bir maçın jant yazması, çevrimdışı modu doğrudan bir
     * hile kapısına çevirirdi (ADR 0007).
     */
    const setup = await openMatchSession(difficulty, loadout, supportLoadout, battlesWon);
    session.current = setup;
    setOfflineMatch(setup.matchId === null);

    setBattle(
      createBattle(playerLoadout, setup.botLoadout, {
        seed: setup.seed,
        botGarageHp: setup.botGarageHp,
        playerGarageHp: setup.playerGarageHp,
        playerOpeningHand: setup.playerOpeningHand,
        botOpeningHand: setup.botOpeningHand,
        playerSupportLoadout: supportLoadout,
        // The bot brings its own three, so Pit Ekibi is a mechanic both
        // sides have rather than a player-only one.
        botSupportLoadout: setup.botSupportLoadout,
      }),
    );
  }, [playerLoadout, loadout, supportLoadout, battlesWon, difficulty, stopResultSfx]);

  useEffect(() => {
    // Oyna ekranındaki "kadro tam mı" kapısının aynısı — /battle'a doğrudan
    // gelen bir bağlantı onu atlamamalı. Eksik kadroyla maç, sunucuda da
    // reddedilir (validateLoadout) ama oyuncuyu hata mesajıyla değil
    // düzeltebileceği yere göndermek doğru.
    if (playerLoadout.length + supportLoadout.length < LOADOUT_TOTAL) {
      router.replace('/garage');
      return;
    }
    void newBattle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastLogId = battle?.log[battle.log.length - 1]?.id ?? 0;
  // Fires only when a NEW log entry lands. `battle` deliberately isn't a dep:
  // it changes identity on every action, and re-running this on each of those
  // used to cancel the pending dismissal below without queueing a new one —
  // which is exactly how toasts ended up stuck on screen forever.
  useEffect(() => {
    const b = battleRef.current;
    if (!b) return;
    const last = b.log[b.log.length - 1];
    if (!last || last.kind === 'turn' || last.kind === 'info') return;
    const kind: ToastKind =
      last.kind === 'result' ? (b.winner === 'player' ? 'success' : 'error') : 'info';
    toast(last.text, kind, last.side);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastLogId]);

  // No timer here on purpose: ActionToast owns its own lifetime (see the
  // countdown bar there), so holding it can pause the dismissal — a setTimeout
  // up here would fire regardless of what the finger is doing.

  // Turn sweep: fires on every turn change, including the very first one (the
  // opening "SIRA SENDE" is a nice announcement, not just a mid-match cue).
  useEffect(() => {
    if (!battle) return;
    sweepId.current += 1;
    setSweepQueue((q) => [
      ...q,
      { id: sweepId.current, type: 'turn', turn: battle.turn, side: battle.active },
    ]);
    // The card drawn for this turn is whatever landed last in hand — true
    // right after startTurn's drawCard(). Skipped on turn 1 (the opening
    // 3-card deal, not a single draw) and on the bot's turns. Waits for the
    // "SIRA SENDE" banner just queued above to fully play out first — it
    // used to pop up at the same time as the banner, on top of it.
    let cancelled = false;
    let t2: ReturnType<typeof setTimeout> | undefined;
    if (battle.turn > 1 && battle.active === 'player' && battle.player.hand.length > 0) {
      const drawn = battle.player.hand[battle.player.hand.length - 1];
      waitForSweepIdle().then(() => {
        if (cancelled) return;
        setDrawReveal({ key: battle.turn, card: drawn });
        t2 = setTimeout(() => setDrawReveal(null), 950);
      });
    }
    return () => {
      cancelled = true;
      if (t2) clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.turn, battle?.active]);

  useEffect(() => {
    if (!battle?.winner || recorded.current) return;
    recorded.current = true;
    const won = battle.winner === 'player';
    Haptics.notificationAsync(
      won ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => { });
    resultSfx.current = playSfx(won ? 'win' : 'lose', won ? 0.75 : 1);

    /**
     * Sonucu SUNUCU belirliyor.
     *
     * Gönderilen şey "kazandım" değil, oyuncunun hamleleri; sunucu maçı aynı
     * tohumla yeniden oynatıp kazananı kendi buluyor ve ödülü ona göre
     * yazıyor. Yerel `recordBattle` yalnızca çevrimdışı oynanmışsa devreye
     * giriyor ve o durumda jant vermiyor — sadece maç sayacını ilerletiyor,
     * çünkü o sayaç yerel bot ölçeklemesinde kullanılıyor.
     */
    void (async () => {
      const result = await recorder.current.submit(session.current?.matchId ?? null);
      if (result) {
        // Sunucunun yazdığı miktar; istemci yeniden hesaplamıyor.
        setServerReward(result.reward);
        await refreshWallet();
      } else {
        recordBattle(won, 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.winner]);

  // No legal move left (can't play a card, can't attack) — just move on
  // instead of making the player tap "Turu Bitir" to acknowledge a dead end.
  // Skipped while a card is selected/mid-drag so it never yanks the turn
  // away from an in-progress action, and skipped entirely if the player
  // turned the little switch on the button off.
  useEffect(() => {
    if (!autoEndTurn || !battle || busy || battle.winner || battle.active !== 'player') return;
    if (selected) return;
    const p = battle.player;
    // Playing a Pit Ekibi card is always optional, never required to make
    // progress — so it doesn't count as "still has a move" here, on purpose.
    // A full board no longer blocks playing: you can always scrap a vehicle
    // to make room, so an affordable card in hand is still a move.
    const canPlay = p.hand.some((c) => c.kind === 'vehicle' && c.cost <= p.fuel);
    const canAttack = p.board.some((v) => v.canAttack && v.health > 0);
    if (canPlay || canAttack) return;
    const t = setTimeout(() => {
      toast('Hamlen kalmadı, tur otomatik bitiyor.', 'info');
      endTurn();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle, busy, selected, autoEndTurn]);

  useEffect(() => () => chatTimers.current.forEach(clearTimeout), []);

  // Both panels hang off buttons that only exist on your turn, so they close
  // with them — otherwise a panel could stay open with nothing to dismiss it.
  useEffect(() => {
    if (battle?.active !== 'player' || busy) {
      setChatOpen(false);
      setHelpOpen(false);
    }
  }, [battle?.active, busy]);

  const targets = useMemo(
    () => (battle ? legalTargets(battle.bot) : { canHitGarage: false, vehicleUids: [] as string[] }),
    [battle],
  );

  const hitTest = useCallback((x: number, y: number): string | null => {
    for (const [id, r] of Object.entries(dropRects.current)) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
    }
    return null;
  }, []);

  const playCard = useCallback(
    (handIndex: number, dropX: number, dropY: number) => {
      const b = battleRef.current;
      if (!b || busy || b.active !== 'player' || b.winner) return;
      const card = b.player.hand[handIndex];
      if (!card || card.cost > b.player.fuel) return;

      const commit = (scrapUid?: string) => {
        const cur = battleRef.current;
        if (!cur) return;
        Haptics.selectionAsync().catch(() => { });
        playSfx('whoosh');
        // Claim the screen before the state lands, so an entry-ability
        // message can't blur over the card while it's still growing.
        holdForSpawn('player');
        setBattle(applyPlayer(cur, { type: 'PLAY', side: 'player', handIndex, scrapUid }));
      };

      // Full board: the card has to land ON one of your own vehicles, which
      // is then scrapped for it. Confirmed first — this destroys a card, and
      // a drag that ends a few pixels off shouldn't cost you a blocker.
      if (b.player.board.length >= BOARD_LIMIT) {
        const hit = hitTest(dropX, dropY);
        const victim = hit ? b.player.board.find((v) => v.uid === hit) : undefined;
        if (!victim) {
          toast(`Saha dolu. Yeni araç için birinin üstüne bırak.`, 'error');
          return;
        }
        dialog.show({
          title: 'Hurdaya ayrılsın mı?',
          message: `${victim.name} sahadan çıkacak, yerine ${card.name} geçecek.`,
          actions: [
            { label: 'Hurdaya ayır', variant: 'danger', onPress: () => commit(victim.uid) },
            { label: 'Vazgeç' },
          ],
        });
        return;
      }
      commit();
    },
    [busy, toast, hitTest, holdForSpawn, dialog],
  );

  /** Why a black-bordered hand card can't be played right now. */
  const explainBlocked = useCallback(
    (cost: number) => {
      const b = battleRef.current;
      if (!b) return;
      if (b.active !== 'player' || busy) {
        toast('Şimdi rakibin sırası.', 'error');
      } else if (cost > b.player.fuel) {
        toast(`Yetersiz yakıt: ${cost} gerekli, elinde ${b.player.fuel} var.`, 'error');
      }
    },
    [busy, toast],
  );

  /** Why a black-bordered board vehicle can't attack right now. */
  const explainAttackBlocked = useCallback(() => {
    const b = battleRef.current;
    if (!b) return;
    if (b.active !== 'player' || busy) toast('Şimdi rakibin sırası.', 'error');
    else toast('Bu araç bu tur saldıramaz.', 'error');
  }, [busy, toast]);

  // Pit Ekibi (support) cards never board and never cost fuel — they just
  // resolve, at most one per turn. Untargeted ones (target: 'none') drag up
  // to play exactly like a vehicle hand card; targeted ones drag onto the
  // actual vehicle they affect, reusing the same ghost/hit-test machinery as
  // a board attack (see onSupportDragStart/End below) — one drag habit for
  // every card in the hand, not a second interaction style to learn.
  const [dragSupport, setDragSupport] = useState<SupportBattleCard | null>(null);
  // Which side's board is a legal drop target right now, and which uids on
  // it — drives the same targetable/blocked styling the attack drag uses.
  const [dragTargetInfo, setDragTargetInfo] = useState<{ side: 'own' | 'enemy'; uids: string[] } | null>(
    null,
  );

  const explainSupportBlocked = useCallback(() => {
    const b = battleRef.current;
    if (!b) return;
    if (b.active !== 'player' || busy) toast('Şimdi rakibin sırası.', 'error');
    else toast('Bu tur zaten bir Pit Ekibi kartı kullandın.', 'error');
  }, [busy, toast]);

  const playSupportNoTarget = useCallback(
    (handIndex: number) => {
      const b = battleRef.current;
      if (!b || busy || b.active !== 'player' || b.winner || b.player.supportPlayedThisTurn) return;
      Haptics.selectionAsync().catch(() => { });
      playSfx('confirm');
      setBattle(applyPlayer(b, { type: 'PLAY_SUPPORT', side: 'player', handIndex }));
    },
    [busy],
  );

  // The worklet already set dragOriginX/Y and dragTx/Ty directly (UI thread,
  // no bridging) — this JS-side call only needs to validate and mark state.
  const onDragStart = useCallback(
    (v: Vehicle) => {
      const b = battleRef.current;
      if (!b || busy || b.active !== 'player' || b.winner) return;
      setSelected(v.uid);
      setDragVehicle(v);
      Haptics.selectionAsync().catch(() => { });
      playSfx('pop', 0.7);
    },
    [busy],
  );

  const onDragEnd = useCallback(
    (x: number, y: number, attackerUid: string) => {
      setSelected(null);
      setDragVehicle(null);
      const b = battleRef.current;
      if (!b || busy || b.active !== 'player' || b.winner) return;
      const hit = hitTest(x, y);
      if (!hit) return; // dropped on empty space — no-op
      // dropRects now also holds the player's OWN vehicles (registered for
      // Pit Ekibi's own-side targeting) — an attack landing on one of those
      // isn't "blocked by a siper", it's just not a valid attack surface at
      // all, so it has to be ruled out before any blocker logic runs.
      const isEnemySurface = hit === 'garage' || b.bot.board.some((v) => v.uid === hit);
      if (!isEnemySurface) return;
      const tg = legalTargets(b.bot);
      if (hit === 'garage') {
        if (!tg.canHitGarage) {
          toast('Siper araçlar garajı koruyor.', 'error');
          emphasizeBlockers(tg.vehicleUids);
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
        playImpact('garage', 'garage');
        setBattle(applyPlayer(b, { type: 'ATTACK', side: 'player', attackerUid, target: 'garage' }));
      } else {
        if (!tg.vehicleUids.includes(hit)) {
          toast('Önce siper araçları geçmelisin.', 'error');
          emphasizeBlockers(tg.vehicleUids);
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        playImpact(hit, 'vehicle');
        setBattle(applyPlayer(b, { type: 'ATTACK', side: 'player', attackerUid, target: hit }));
      }
    },
    [busy, hitTest, toast, playImpact, emphasizeBlockers],
  );

  const onSupportDragStart = useCallback((card: SupportBattleCard) => {
    const b = battleRef.current;
    if (!b) return;
    const legal = legalSupportTargets(card, b.player, b.bot);
    setDragSupport(card);
    setDragTargetInfo({ side: card.target === 'enemyVehicle' ? 'enemy' : 'own', uids: legal });
    Haptics.selectionAsync().catch(() => { });
    playSfx('pop', 0.7);
  }, []);

  const onSupportDragEnd = useCallback(
    (handIndex: number, card: SupportBattleCard, x: number, y: number) => {
      setDragSupport(null);
      setDragTargetInfo(null);
      const b = battleRef.current;
      if (!b || busy || b.active !== 'player' || b.winner || b.player.supportPlayedThisTurn) return;
      const hit = hitTest(x, y);
      if (!hit) return; // dropped on empty space — no-op
      const legal = legalSupportTargets(card, b.player, b.bot);
      if (!legal.includes(hit)) {
        toast('Bunu hedefleyemezsin.', 'error');
        return;
      }
      Haptics.selectionAsync().catch(() => { });
      playSfx('confirm');
      setBattle(applyPlayer(b, { type: 'PLAY_SUPPORT', side: 'player', handIndex, targetUid: hit }));
    },
    [busy, hitTest, toast],
  );

  const endTurn = async () => {
    if (!battle || busy || battle.active !== 'player' || battle.winner) return;
    setSelected(null);
    setBusy(true);
    playSfx('confirm');

    // Oyuncunun turu kapandı: biriken hamleler bir "tur" olarak mühürleniyor.
    // Sunucu maçı tur tur yeniden oynatıyor, o yüzden sınırların birebir
    // aynı yerde olması şart.
    recorder.current.endTurn();

    // "RAKİBİN SIRASI" queues itself (see the turn-change effect) the moment
    // this lands — wait for it to fully sweep in/hold/out before the bot's
    // moves start landing, so the two never show at once.
    let s = applyAction(battle, { type: 'END_TURN' });
    setBattle(s);
    if (s.winner) return setBusy(false);
    await waitForSweepIdle();

    // Hata oranı SUNUCUDAN gelen kurulumdan okunuyor, yerel presetten değil:
    // sunucu maçı doğrularken botu bu değerle yeniden planlıyor, ikisi
    // ayrışırsa bot farklı oynar ve sonuç tutmaz.
    const actions = planBotTurn(s, session.current?.botBlunderChance ?? preset.botBlunderChance);
    for (const action of actions) {
      if (action.type === 'ATTACK') {
        // 'garage' here is relative to the acting side — for the bot that's
        // the player's garage, the one tracked as 'playerGarage'.
        const targetId = action.target === 'garage' ? 'playerGarage' : action.target;
        const isGarageHit = action.target === 'garage';
        Haptics.impactAsync(
          isGarageHit ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
        ).catch(() => { });
        playImpact(targetId, isGarageHit ? 'garage' : 'vehicle');
        // Let the hit itself (shake/burst, see playImpact) actually finish
        // before the blur+recap message comes in over it — they used to
        // land almost together.
        await sleep(isGarageHit ? 760 : 580);
      }
      // Same reservation the player's own play makes: the bot's card gets
      // its full arrival animation before any message blurs over it.
      if (action.type === 'PLAY') holdForSpawn(action.side);
      s = applyAction(s, action);
      setBattle(s);
      if (s.winner) return setBusy(false);
      // Each move's own recap message plays out (queued, blurred) before the
      // next move lands — "hamleler sırayla gelip gider" instead of the
      // whole log dumping into the queue back-to-back. waitForSweepIdle also
      // sits through the spawn animation above.
      await waitForSweepIdle();
    }
    s = applyAction(s, { type: 'END_TURN' });
    setBattle(s);
    setBusy(false);
  };

  const sendTemplate = (msg: string) => {
    chatTimers.current.forEach(clearTimeout);
    chatTimers.current = [];
    setChatOpen(false);
    setChatToast({ text: msg, mine: true });
    chatTimers.current.push(
      setTimeout(() => {
        const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        setChatToast({ text: reply, mine: false });
        chatTimers.current.push(setTimeout(() => setChatToast(null), 1600));
      }, 900),
    );
  };

  if (!battle) return <SafeAreaView style={styles.fill} />;

  const { player, bot } = battle;
  const yourTurn = battle.active === 'player' && !busy && !battle.winner;

  const boardFull = player.board.length >= BOARD_LIMIT;
  const canPlayAny = player.hand.some((c) => c.kind === 'vehicle' && c.cost <= player.fuel);
  const canAttackAny = player.board.some((v) => v.canAttack && v.health > 0);
  // Nothing while the bot plays — the end-turn button already says
  // "RAKİP OYNUYOR…", and two copies of the same sentence just add noise.
  // Pit Ekibi is never mentioned here on purpose — using one is always
  // optional, so there's no "you still have a move" nudge for it.
  const hint = !yourTurn
    ? ''
    : selected
      ? 'Şimdi sahandaki aracınla hedefe sürükleyerek saldır!'
      : canAttackAny
        ? 'Sahandaki yeşil çerçeveli aracını hedefe sürükle!'
        : canPlayAny
          ? boardFull
            ? 'Saha dolu! Yeni araç için birinin üstüne bırak, o araç hurdaya ayrılsın'
            : 'Aşağıdan bir kartı yukarı sürükleyip sahaya sür'
          : autoEndTurn
            ? 'Hamlen kalmadı, tur otomatik bitiyor…'
            : 'Hamlen kalmadı. Turu Bitir\'e bas.';

  const botPct = Math.round((bot.garageHp / Math.max(1, bot.garageMaxHp)) * 100);
  const playerPct = Math.round((player.garageHp / Math.max(1, player.garageMaxHp)) * 100);
  const botGarageTargetable = !!selected && targets.canHitGarage;
  // A Pit Ekibi card being dragged targets one specific side's board — same
  // targetable/blocked styling the attack drag uses, just driven by whichever
  // drag (attack or support) is actually in progress right now.
  const enemyDragActive = dragTargetInfo?.side === 'enemy';
  const enemyDragUids = enemyDragActive ? dragTargetInfo.uids : [];
  const ownDragActive = dragTargetInfo?.side === 'own';
  const ownDragUids = ownDragActive ? dragTargetInfo.uids : [];

  return (
    <Animated.View style={[styles.fill, screenShakeStyle]}>
      {/* Arena backdrop — behind the whole screen, not just the boards. */}
      <ArenaBackdrop width={screenWidth} height={screenHeight} />
      {/* Whole-screen "you felt that" flash — a landed hit, not just the
          local burst. Non-interactive and one-shot, so unlike the old
          full-screen dim it needs no coordinates to stay in sync with. */}
      <Animated.View pointerEvents="none" style={[styles.screenFlash, screenFlashStyle]} />

      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        {/* No scrolling any more: three slots a side fits one viewport, and
            a fixed board is strictly better here — drop targets are measured
            in window-absolute coordinates, so scrolling was the one thing
            that could silently invalidate all of them mid-drag. */}
        <View style={[styles.screen, styles.scroll, { paddingBottom: handHeight + space.md }]}>
          {/* Header is now just leave / sound — one round icon on each side.
              Chat moved down into the action bar between the two boards,
              where the rest of the in-match controls live. */}
          <View style={styles.header}>
            <Pressable style={styles.headerBtn} onPress={() => router.replace('/')}>
              <MaterialCommunityIcons name="close-thick" size={17} color={colors.dangerInk} />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={toggleSound}>
              <MaterialCommunityIcons
                name={soundOn ? 'volume-high' : 'volume-off'}
                size={17}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          {/* ── rakip sahası ─────────────────────────────────────────── */}
          <View style={[styles.zone, spawnSide === 'bot' && styles.zoneElevated]}>
            <GarageBar
              label="Rakip Garaj"
              hp={bot.garageHp}
              pct={botPct}
              fuel={`${bot.fuel}/${bot.maxFuel}`}
              tint={colors.dangerInk}
              borderColor={botGarageTargetable ? colors.danger : 'transparent'}
              registerRect={(r) => registerDropRect('garage', r)}
              measureTick={scrollTick}
              hitToken={hitTokens.garage}
              deadCount={deadCards.bot.length}
              onDeadPress={() => setGraveyardOpen('bot')}
            />
            {/* Always BOARD_LIMIT tiles wide: real cards first, empty slots
                padding the rest. The row's height and the cards' positions
                never change as vehicles come and go, which is what stops the
                whole screen shifting mid-turn. */}
            <View style={styles.boardRow}>
              {[
                ...bot.board.map((v) => (
                  <EnemyVehicleCard
                    key={v.uid}
                    v={v}
                    size={cardSize}
                    targetable={(!!selected && targets.vehicleUids.includes(v.uid)) || enemyDragUids.includes(v.uid)}
                    blocked={
                      (!!selected && !targets.vehicleUids.includes(v.uid)) ||
                      (enemyDragActive && !enemyDragUids.includes(v.uid))
                    }
                    onInspect={() => setInspect(inspectFromVehicle(v))}
                    registerRect={(r) => registerDropRect(v.uid, r)}
                    measureTick={scrollTick}
                    hitToken={hitTokens[v.uid]}
                    highlightToken={highlightTokens[v.uid]}
                  />
                )),
                ...Array.from({ length: Math.max(0, BOARD_LIMIT - bot.board.length) }, (_, i) => (
                  <EmptySlot key={`bot-slot-${i}`} size={cardSize} side="bot" />
                )),
              ]}
              {chatToast && !chatToast.mine ? (
                <ChatBubble key={`bot-${chatToast.text}`} text={chatToast.text} mine={false} />
              ) : null}
            </View>
          </View>

          {/* Action bar, on the seam between the two boards — the reference
              puts End Turn right here at the halfway line, and gathering the
              match controls in one row is what let the header shrink to two
              icons and the hint stop living on screen permanently.

              The whole row appears and disappears as one, only on your turn:
              popping a single button in and out re-centred the other two and
              made the row twitch every time the turn changed. */}
          {/* The slot keeps its height whether or not the buttons are in it:
              letting the row collapse on the bot's turn pulled the whole
              lower half of the board up and then dropped it back. */}
          <View style={styles.actionBar}>
            {yourTurn && !battle.winner ? (
              <Animated.View
                style={styles.actionBarRow}
                entering={ZoomIn.duration(220)}
                exiting={ZoomOut.duration(160)}
              >
                <ActionButton
                  icon={chatOpen ? 'close-thick' : 'chat'}
                  label={chatOpen ? 'Kapat' : 'Mesaj Yaz'}
                  tint={colors.successInk}
                  onPress={() => setChatOpen((v) => !v)}
                />
                <ActionButton icon="flag-checkered" label="Turu Bitir" primary onPress={endTurn} />
                <ActionButton
                  icon={helpOpen ? 'close-thick' : 'lifebuoy'}
                  label={helpOpen ? 'Kapat' : 'Yardım Et'}
                  tint={colors.accentInk}
                  onPress={() => setHelpOpen((v) => !v)}
                />
              </Animated.View>
            ) : null}
          </View>

          {/* ── benim saham ──────────────────────────────────────────── */}
          <View style={[styles.zone, spawnSide === 'player' && styles.zoneElevated]}>
            <View style={styles.boardRow}>
              {[
                ...player.board.map((v) => (
                  <PlayerVehicleCard
                    key={v.uid}
                    v={v}
                    size={cardSize}
                    canAttack={!!(v.canAttack && v.health > 0 && yourTurn)}
                    isDragging={dragVehicle?.uid === v.uid}
                    targetable={ownDragUids.includes(v.uid)}
                    blocked={ownDragActive && !ownDragUids.includes(v.uid)}
                    dragOriginX={dragOriginX}
                    dragOriginY={dragOriginY}
                    dragTx={dragTx}
                    dragTy={dragTy}
                    onDragStart={() => onDragStart(v)}
                    onDragEnd={(x, y) => onDragEnd(x, y, v.uid)}
                    onBlocked={explainAttackBlocked}
                    onInspect={() => setInspect(inspectFromVehicle(v))}
                    registerRect={(r) => registerDropRect(v.uid, r)}
                    measureTick={scrollTick}
                    hitToken={hitTokens[v.uid]}
                  />
                )),
                ...Array.from({ length: Math.max(0, BOARD_LIMIT - player.board.length) }, (_, i) => (
                  <EmptySlot
                    key={`player-slot-${i}`}
                    size={cardSize}
                    side="player"
                    // Only the very first slot of an empty board carries the
                    // "drag one up here" arrow — on a half-full board it's
                    // three copies of an instruction you no longer need.
                    hint={player.board.length === 0 && i === 0}
                  />
                )),
              ]}
              {chatToast?.mine ? (
                <ChatBubble key={`me-${chatToast.text}`} text={chatToast.text} mine />
              ) : null}
            </View>
            <GarageBar
              label="Garajım"
              hp={player.garageHp}
              pct={playerPct}
              fuel={`${player.fuel}/${player.maxFuel}`}
              tint={colors.primaryInk}
              borderColor="transparent"
              registerRect={(r) => registerDropRect('playerGarage', r)}
              measureTick={scrollTick}
              hitToken={hitTokens.playerGarage}
              deadCount={deadCards.player.length}
              onDeadPress={() => setGraveyardOpen('player')}
            />
          </View>
        </View>

        {/* Help tooltip — the hint plus the auto-end-turn preference in one
            container, hanging right under the button that opens it. Same
            absolute placement (and the same reason) as the chat panel: in
            the scroll flow it would push the board and stale every measured
            drop target while open. */}
        {helpOpen && !battle.winner ? (
          <>
            {/* Tap-anywhere-to-dismiss. Transparent and full-screen, under
                the tooltip but over the board, so a stray tap closes the
                panel instead of playing a card behind it. */}
            <Pressable style={styles.tooltipScrim} onPress={() => setHelpOpen(false)} />
            <View
              pointerEvents="box-none"
              style={[styles.tooltipWrap, { top: arenaSeam(screenHeight) + 30 }]}
            >
              <View style={styles.helpTip}>
                {hint ? (
                  <View style={styles.helpTipRow}>
                    <MaterialCommunityIcons name="alert-circle" size={15} color={colors.accentInk} />
                    <Text style={styles.helpTipText}>{hint}</Text>
                  </View>
                ) : null}
                {/* Always here, unlike the hint above: it's a control you can
                    always use, not something that applies only right now. */}
                <View style={styles.helpTipRow}>
                  <MaterialCommunityIcons name="gesture-tap-hold" size={15} color={colors.textMuted} />
                  <Text style={[styles.helpTipText, { color: colors.textMuted }]}>
                    Bir kartın özelliklerini görmek için üzerine basılı tut.
                  </Text>
                </View>
                <Pressable style={styles.autoRow} onPress={toggleAutoEndTurn}>
                  <Text style={styles.autoRowLabel}>Hamlem kalmayınca turu otomatik bitir</Text>
                  <View style={[styles.autoSwitchTrack, autoEndTurn && styles.autoSwitchTrackOn]}>
                    <View style={styles.autoSwitchKnob} />
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        {/* Chat panel — opens just under its own button on the halfway line
            now that the button moved there. Still absolutely positioned
            rather than in the scroll flow: pushing the board down would
            invalidate every measured drop target while it's open. */}
        {chatOpen ? (
          <>
            <Pressable style={styles.tooltipScrim} onPress={() => setChatOpen(false)} />
            <View
              pointerEvents="box-none"
              style={[styles.tooltipWrap, { top: arenaSeam(screenHeight) + 30 }]}
            >
              <View style={styles.chatPanel}>
                {QUICK_MESSAGES.map((m) => (
                  <Pressable key={m} style={styles.chatMsg} onPress={() => sendTemplate(m)}>
                    <Text style={styles.chatMsgText}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {/* chat toast — sits by the chat icon (top-left), separate from the
            action toast. Slides in/out from the left, matching that spot. */}
        {/* card inspector — long-press any card to see what it actually does,
            styled after the Card Detail page so it isn't just a bare text box */}
        {inspect ? <InspectPanel data={inspect} onClose={() => setInspect(null)} /> : null}

        {/* Pit Ekibi long-press inspector — same idea as InspectPanel above,
            just for a support card's much simpler shape (no stats/rarity). */}
        {supportInspect ? (
          <SupportInspectPanel card={supportInspect} onClose={() => setSupportInspect(null)} />
        ) : null}

        {/* Graveyard — which cards on this side have been destroyed so far. */}
        {graveyardOpen ? (
          <GraveyardModal
            side={graveyardOpen}
            cards={deadCards[graveyardOpen]}
            onClose={() => setGraveyardOpen(null)}
          />
        ) : null}

        {/* hand — a drawer: tap the grabber bar to fold it away. No solid
            panel behind it, just a fade so the grabber/label stay readable;
            it's tinted to the arena's own blue half now rather than cream,
            since that's what's actually behind the cards down here. */}
        <View style={styles.hand} onLayout={onHandLayout}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(23,63,142,0)', 'rgba(23,63,142,0.45)']}
            locations={[0, 0.55]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={styles.handGrabberArea}
            onPress={() => setHandCollapsed((v) => !v)}
            hitSlop={8}
          >
            {/* Grabber only. The "press and hold a card" line that used to
                live here is permanent information, not a per-moment cue, so
                it moved into the help tooltip where it can just sit. */}
            <View style={styles.handGrabber} />
            {handCollapsed ? (
              <View style={styles.handLabelRow}>
                <MaterialCommunityIcons name="chevron-up" size={13} color="rgba(255,255,255,0.72)" />
                <Text style={styles.handLabel}>Kartları göster</Text>
              </View>
            ) : null}
          </Pressable>
          <Animated.View
            style={[styles.handRowClip, handRowAnimStyle, !handClipped && styles.handRowOpen]}
          >
            <View style={styles.handRow}>
              {player.hand.length === 0 ? (
                <Text style={styles.handEmpty}>El boş</Text>
              ) : (
                player.hand.map((c, i) => {
                  const mid = (player.hand.length - 1) / 2;
                  const off = i - mid;
                  const rot = Math.round(off * 6);
                  const lift = Math.round(Math.abs(off) * Math.abs(off) * 2.5);
                  // Kartlar 72'den 88 px'e büyüdü, o yüzden üst üste binme
                  // artık sabit değil: el kalabalıklaştıkça adım daralıyor ki
                  // yelpaze ekranın sağından taşmasın.
                  const overlap = i === 0 ? 0 : handStep(player.hand.length, screenWidth) - HC_W;

                  if (c.kind === 'support') {
                    return (
                      <SupportHandCard
                        key={c.uid}
                        card={c}
                        usable={yourTurn && !player.supportPlayedThisTurn}
                        rot={rot}
                        lift={lift}
                        overlap={overlap}
                        dragOriginX={dragOriginX}
                        dragOriginY={dragOriginY}
                        dragTx={dragTx}
                        dragTy={dragTy}
                        onPlayUntargeted={() => playSupportNoTarget(i)}
                        onDragStart={() => onSupportDragStart(c)}
                        onDragEnd={(x, y) => onSupportDragEnd(i, c, x, y)}
                        onBlocked={explainSupportBlocked}
                        onInspect={() => setSupportInspect(c)}
                      />
                    );
                  }

                  return (
                    <HandCard
                      key={c.uid}
                      card={c}
                      affordable={yourTurn && c.cost <= player.fuel}
                      rot={rot}
                      lift={lift}
                      overlap={overlap}
                      onPlay={(x, y) => playCard(i, x, y)}
                      onBlocked={() => explainBlocked(c.cost)}
                      onInspect={() =>
                        setInspect({
                          cardId: c.cardId,
                          name: c.name,
                          attack: c.attack,
                          speed: c.speed,
                          health: c.health,
                          maxHealth: c.health,
                          cost: c.cost,
                        })
                      }
                    />
                  );
                })
              )}
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Board lock: while any announcement is playing (or waiting its turn),
          the board is blurred and this swallows every touch to it — rendered
          outside the SafeAreaView, same reason as the dim below, so it isn't
          muddied by anything inside during a drag. Fades in fast, out slow
          ("yavaşça kalksın"), and stays interactive-blocking exactly as long
          as uiLocked says, independent of how far the fade has gotten. */}
      <Animated.View pointerEvents={uiLocked ? 'auto' : 'none'} style={[styles.lockOverlay, lockOverlayStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={() => sweepPauseRef.current?.hold()}
          onPressOut={() => sweepPauseRef.current?.release()}
        >
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        </Pressable>
      </Animated.View>

      {activeSweep ? (
        // Keyed by content so every new item remounts it — fresh sweep,
        // even back-to-back.
        <InfoSweep
          key={activeSweep.id}
          item={activeSweep}
          top={insets.top + (screenHeight - insets.top) * 0.5 - 42}
          onDone={dismissSweep}
          pauseRef={sweepPauseRef}
        />
      ) : null}

      {drawReveal ? <DrawReveal key={drawReveal.key} card={drawReveal.card} /> : null}

      {/* No more full-screen dim / cloned-above-the-dim overlays — they were
          positioned in window-absolute coordinates and drifted out of sync
          with the board. Attack-mode feedback now lives on the cards
          themselves: EnemyVehicleCard dims its own not-a-valid-target state
          locally, and the red/green border already flags what you can hit —
          no top-level overlay to keep in sync with anything. */}
      {dragVehicle ? (
        <DragGhost v={dragVehicle} size={cardSize} originX={dragOriginX} originY={dragOriginY} tx={dragTx} ty={dragTy} />
      ) : null}
      {dragSupport ? (
        <SupportDragGhost card={dragSupport} originX={dragOriginX} originY={dragOriginY} tx={dragTx} ty={dragTy} />
      ) : null}

      {/* impact bursts — one-shot, each removes itself via onDone */}
      {impacts.map((imp) => (
        <ImpactBurst key={imp.id} x={imp.x} y={imp.y} kind={imp.kind} onDone={() => removeImpact(imp.id)} />
      ))}

      {/* win/loss — a real modal, not squeezed into the scroll flow */}
      {battle.winner ? (
        <View style={styles.resultScrim}>
          <View style={styles.resultPanel}>
            <Text
              style={[
                styles.resultText,
                { color: battle.winner === 'player' ? colors.successInk : colors.dangerInk },
              ]}
            >
              {battle.winner === 'player' ? 'KAZANDIN! 🏆' : 'KAYBETTİN'}
            </Text>
            {/* Ödül SUNUCUNUN yazdığı miktar. Gelene kadar tahmini gösteriyoruz
                (aynı formül, aynı sayı — sadece henüz onaylanmamış); çevrimdışı
                oynanmışsa ödül yok ve bunu saklamıyoruz. */}
            {isGuest ? (
              /**
               * MİSAFİR: kazanılmayan ödül gösteriliyor.
               *
               * Rakam gerçek — sunucu o maçın ne ettiğini biliyor ve
               * yanıtta söylüyor; uydurma bir sayı değil. Üstü çizili ve gri,
               * çünkü kazanılmış gibi durmaması gerekiyor.
               *
               * Teklif bir kez reddedilirse bir daha çıkmıyor: aynı soruyu her
               * maçta sormak, cevabı hayır olan oyuncuyu oyundan kovmanın yolu.
               */
              !guestOfferDismissed && (
                <View style={styles.guestOffer}>
                  <View style={styles.guestMissed}>
                    <CurrencyTag currency="rim" amount={missedReward} size={17} color={colors.textMuted} />
                    <Text style={styles.guestMissedText}>
                      Giriş yapsaydın {missedReward} jant kazanacaktın
                    </Text>
                  </View>
                  <ChunkyButton
                    variant="primary"
                    label="Giriş Yap ve Kazan"
                    onPress={() => {
                      stopResultSfx();
                      router.push('/sign-in');
                    }}
                  />
                  <Pressable style={styles.guestSkip} onPress={dismissGuestOffer}>
                    <Text style={styles.guestSkipText}>Misafir olarak devam et</Text>
                  </Pressable>
                </View>
              )
            ) : offlineMatch ? (
              <View style={styles.resultOffline}>
                <MaterialCommunityIcons name="wifi-off" size={13} color={colors.textMuted} />
                <Text style={styles.resultOfflineText}>Çevrimdışı maç — jant kazanılmadı</Text>
              </View>
            ) : (
              <View style={styles.resultReward}>
                <Text style={styles.resultRewardPlus}>+</Text>
                <CurrencyTag
                  currency="rim"
                  amount={serverReward ?? battleReward(battle.winner === 'player', difficulty)}
                  size={18}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.resultBtn} onPress={() => void newBattle()}>
                <Text style={styles.resultBtnText}>Tekrar Oyna</Text>
              </Pressable>
              <Pressable
                style={[styles.resultBtn, styles.resultBtnAlt]}
                onPress={() => {
                  stopResultSfx();
                  router.replace('/');
                }}
              >
                <Text style={[styles.resultBtnText, { color: colors.primaryInk }]}>Menü</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

/** Top-centered action toast. The countdown bar under the text IS the timer:
 *  a shared value running 1 → 0 drives both the bar's width and the dismissal,
 *  so holding the toast pauses it where it stands and letting go carries on
 *  from there instead of restarting. */
/** The primary/accent pair used for anything tied to a side — the turn
 *  banner and, now, combat log lines: your own moves in blue, the
 *  opponent's in orange/red, always the same two colors either way. */
function sideGradient(side: SideId): [string, string] {
  return side === 'player' ? [colors.primary, colors.primaryInk] : [colors.accent, colors.dangerInk];
}

/** The two colors an InfoSweep's bar gradient runs between — a real gradient
 *  for turn changes and for any combat log line that's attributed to a side
 *  (matches the reference), a flat "gradient" (same color twice) for the
 *  remaining kind-based text items (rejections, results) so one
 *  component/animation covers all of it. */
function sweepGradient(item: SweepItem): [string, string] {
  if (item.type === 'turn') return sideGradient(item.side);
  if (item.side) return sideGradient(item.side);
  const s = TOAST_STYLE[item.kind];
  return [s.bg, s.bg];
}

/** pushLog wraps the "how much" part of a combat line in `**...**` (e.g.
 *  "Rakip garaja **3 hasar**.") so it can be picked out and rendered heavier
 *  in the sweep — a lightweight convention, not real markdown, just enough
 *  to stop every number from disappearing into a wall of same-weight text. */
function splitEmphasis(text: string): { text: string; emph: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((t, i) => ({ text: t, emph: i % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}

/** The one announcement presentation for everything about "what's happening
 *  in the match" — a turn change, a combat log line, a rejected action.
 *  Same skewed sweep-in/hold/sweep-out every time (matches the reference's
 *  cc-banner-sweep keyframe), just different content/color. Calls onDone
 *  itself once the sweep-out finishes, so the queue can promote the next
 *  item — no external timer to keep in sync with the animation any more. */
function InfoSweep({
  item,
  top,
  onDone,
  pauseRef,
}: {
  item: SweepItem;
  top: number;
  onDone: () => void;
  pauseRef: MutableRefObject<{ hold: () => void; release: () => void } | null>;
}) {
  const { width } = useWindowDimensions();
  const isTurn = item.type === 'turn';
  // Text items (combat log, rejections) can be held to pause and actually
  // read them — same idea the old toast had. The turn banner is two words,
  // it doesn't need it. One linear `progress` (0→1) drives everything —
  // position/opacity through interpolate()'s stops, which is where the
  // ease-in/hold/ease-out feel actually comes from, so pausing/resuming
  // mid-flight never has to fight an eased timing curve.
  const totalMs = isTurn ? 1430 : 1900;
  const progress = useSharedValue(0);
  const [held, setHeld] = useState(false);

  const run = useCallback(
    (from: number) => {
      progress.value = from;
      progress.value = withTiming(
        1,
        { duration: Math.max(1, (1 - from) * totalMs), easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      );
    },
    [onDone, progress, totalMs],
  );

  useEffect(() => {
    run(0);
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = useCallback(() => {
    cancelAnimation(progress);
    setHeld(true);
  }, [progress]);
  const release = useCallback(() => {
    setHeld(false);
    run(progress.value);
  }, [run, progress]);

  // The actual touch that pauses this lives on the full-screen lock overlay
  // in BattleScreen (anywhere on the blurred board, not just this bar) — it
  // reaches this instance's hold/release through the shared ref.
  useEffect(() => {
    pauseRef.current = { hold, release };
    return () => {
      pauseRef.current = null;
    };
  }, [pauseRef, hold, release]);

  // Explicit width:'100%' here (not left to the default flex stretch) is
  // what actually makes the bar full-width — turnBannerWrap centers its
  // children (alignItems:'center'), so without this the bar shrink-wraps to
  // its text instead of filling the screen.
  const barStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const tx = interpolate(p, [0, 0.15, 0.85, 1], [-width * 1.3, 0, 0, width * 1.3], Extrapolation.CLAMP);
    const opacity = interpolate(p, [0, 0.15, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    return { width: '100%', transform: [{ skewX: '-6deg' }, { translateX: tx }], opacity };
  });
  // Empties across the HOLD only (0.15 → 0.85), not across the whole run.
  // Mapped over the full 0 → 1 it still read ~20% full at the moment the bar
  // started sweeping out, so the message looked like it was leaving early
  // with time left on the clock. Now the bar hits empty exactly as the sweep
  // out begins: the timer measures how long you have to read it, which is
  // the only part of the animation the bar is actually about.
  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0.15, 0.85], [100, 0], Extrapolation.CLAMP)}%`,
  }));

  // A combat line attributed to a side (your move vs. the opponent's) always
  // reads white-on-color, same as the turn banner, regardless of its old
  // info/error/success kind — only un-attributed lines (rejections, results)
  // still fall back to that kind-based look.
  const textStyle = isTurn
    ? TOAST_STYLE.info
    : item.side
      ? { bg: '', fg: '#FFFFFF', icon: 'lightning-bolt' as const }
      : TOAST_STYLE[item.kind];

  const face = (
    <LinearGradient
      colors={sweepGradient(item)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.turnBannerBar}
    >
      {isTurn ? (
        <Text style={styles.turnBannerText}>{item.side === 'player' ? 'Sıra Sende' : 'Rakip Oynuyor'}</Text>
      ) : (
        <>
          {/* Counter-skewed back to upright — the bar's own skew reads fine
              on a short bold turn label, but on a full sentence at reading
              size it just looked slanted and harder to read. */}
          <View style={[styles.sweepTextRow, { transform: [{ skewX: '6deg' }] }]}>
            <MaterialCommunityIcons name={held ? 'pause' : textStyle.icon} size={17} color={textStyle.fg} />
            <Text style={[styles.sweepText, { color: textStyle.fg }]}>
              {splitEmphasis(item.text).map((part, i) =>
                part.emph ? (
                  <Text key={i} style={styles.sweepTextEmph}>
                    {part.text}
                  </Text>
                ) : (
                  part.text
                ),
              )}
            </Text>
          </View>
          <View style={styles.sweepTrack}>
            <Animated.View style={[styles.sweepFill, { backgroundColor: textStyle.fg }, fillStyle]} />
          </View>
        </>
      )}
    </LinearGradient>
  );

  return (
    // The bar itself no longer handles touch — holding to pause now works
    // from anywhere on the blurred board (see the lock overlay in
    // BattleScreen), so this whole thing is purely visual.
    <View pointerEvents="none" style={[styles.turnBannerWrap, { top }]}>
      <Animated.View style={barStyle}>
        {/* A second, darker card peeking out behind/below the main one —
            the flat single bar looked a bit thin, this reads more "layered". */}
        <View pointerEvents="none" style={[styles.sweepDepthLayer, { backgroundColor: sweepGradient(item)[1] }]} />
        {face}
      </Animated.View>
      {isTurn ? (
        <View style={styles.turnBannerChip}>
          <Text style={styles.turnBannerChipText}>TUR {item.turn}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** "You drew this" reveal — pops up big and settles, then shrinks away
 *  downward toward the hand, fading out. One continuous progress value
 *  driving `interpolate()` at the same keyframe stops as the reference
 *  (0 / .32 / .62 / 1) instead of a chain of separate animations. */
function DrawReveal({ card }: { card: HandCard }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 900, easing: Easing.linear });
  }, [progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const scale = interpolate(p, [0, 0.32, 0.62, 1], [0.4, 1.06, 1, 0.22], Extrapolation.CLAMP);
    const translateY = interpolate(p, [0, 0.32, 0.62, 1], [10, 0, 0, 230], Extrapolation.CLAMP);
    const opacity = interpolate(p, [0, 0.06, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    // One spin (was two, and over a shorter/faster window) as it pops in,
    // landing flat around the 45% mark — a "flip" flourish without needing
    // separate card-back art. Stretched past the 32% pop-in stop on purpose
    // so the spin itself reads slower, not just "fewer degrees, same speed".
    const spin = interpolate(p, [0, 0.45], [360, 0], Extrapolation.CLAMP);
    return {
      transform: [{ perspective: 800 }, { translateY }, { scale }, { rotateY: `${spin}deg` }],
      opacity,
    };
  });

  const isVehicle = card.kind === 'vehicle';
  const bg = isVehicle ? rarOf(card.cardId).art : colors.grapeSoft;

  return (
    <View pointerEvents="none" style={styles.drawRevealWrap}>
      <Animated.View style={[styles.drawRevealCard, { backgroundColor: bg }, style]}>
        <Text style={styles.drawRevealTag}>YENİ KART</Text>
        {isVehicle ? (
          <Image source={carImage(card.cardId)} style={styles.drawRevealImg} resizeMode="cover" />
        ) : (
          <Text style={styles.drawRevealEmoji}>{card.emoji}</Text>
        )}
        <Text style={styles.drawRevealName} numberOfLines={1}>
          {card.name}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * The arena floor. Drawn, not photographed: two flat halves split down the
 * middle of the screen (the opponent's red/orange above, yours in blue below)
 * with one big oval table floating over the seam, so which half of the board
 * belongs to whom is readable before a single card is on it.
 *
 * Everything here is derived from the live screen size rather than baked into
 * an image, which is the point: a fixed-ratio photo either letterboxes or
 * crops on a different phone, and the old one needed a 95%-opaque cream scrim
 * over it to stay legible anyway — at which point it wasn't really visible.
 * Purely decorative, never interactive (pointerEvents none all the way down).
 */
function ArenaBackdrop({ width, height }: { width: number; height: number }) {
  // A real ellipse, not a stadium/pill: RN has no ellipse primitive and
  // percentage border radii are still uneven across platforms, so this is a
  // circle as wide as the table squashed vertically — the one construction
  // that's guaranteed to render as an ellipse everywhere.
  const tableW = width * TABLE_WIDTH_RATIO;
  const tableH = height * TABLE_HEIGHT_RATIO;
  const seam = arenaSeam(height);
  const circleR = width * 0.22;
  const table = {
    left: (width - tableW) / 2,
    // Centred on the seam, not on the screen, so the halves meet exactly on
    // the table's own centre line.
    top: seam - tableW / 2,
    width: tableW,
    height: tableW,
    borderRadius: tableW / 2,
    transform: [{ scaleY: tableH / tableW }],
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.dangerInk, colors.danger, colors.accent]}
        style={[styles.arenaHalfTop, { height: seam }]}
      />
      <LinearGradient
        colors={[colors.primary, colors.primaryDark, '#173F8E']}
        style={[styles.arenaHalfBottom, { height: height - seam }]}
      />

      <View style={[styles.arenaTable, table]}>
        {/* Faint side tints carried onto the table itself, so the halves stay
            readable in the middle of the board and not just at the edges. */}
        <LinearGradient
          colors={['rgba(240,74,71,0.14)', 'rgba(240,74,71,0)']}
          style={styles.arenaTableTint}
        />
        <LinearGradient
          colors={['rgba(58,123,240,0)', 'rgba(58,123,240,0.14)']}
          style={[styles.arenaTableTint, styles.arenaTableTintBottom]}
        />
      </View>
      {/* Centre line + centre circle: the "this is a pitch" cue, sitting on
          the seam between the two halves. Siblings of the table rather than
          children of it, positioned in plain screen coordinates — inside it
          they were off by exactly the rim thickness, because a percentage
          offset resolves against the parent's border box while the offset
          itself starts at its padding box. Out here there's no border and no
          scaleY in the way, so the circle is also a true circle. */}
      <View style={[styles.arenaMidline, { top: seam - ARENA_RIM / 2 }]} />
      <View
        style={[
          styles.arenaCentreCircle,
          {
            left: width / 2 - circleR,
            top: seam - circleR,
            width: circleR * 2,
            height: circleR * 2,
            borderRadius: circleR,
          },
        ]}
      />
    </View>
  );
}

/**
 * A single empty board slot, shown when a side has no vehicles out. It
 * replaces the two sentences that used to sit there ("Rakip sahası boş" /
 * "Kartını yukarı sürükleyip sahaya sür"): an empty, dashed card outline says
 * "a vehicle belongs here" without anything to read, and it keeps the row at
 * its normal height so the board doesn't jump when the first card lands.
 */
function EmptySlot({
  size,
  side,
  hint = false,
}: {
  size: { width: number; height: number };
  side: SideId;
  hint?: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.emptySlot,
        { width: size.width, height: size.height },
        side === 'player' ? styles.emptySlotOwn : styles.emptySlotEnemy,
      ]}
    >
      {hint ? (
        <MaterialCommunityIcons name="arrow-up-bold" size={22} color="rgba(46,98,200,0.45)" />
      ) : null}
    </View>
  );
}

/**
 * A quick-message bubble, rendered inside the board row of whoever sent it:
 * yours slides in from the right over your own three slots, the opponent's
 * from the left over theirs. Living inside the row rather than floating at a
 * computed screen position means it's always vertically centred on that
 * side's cards, whatever the card size works out to.
 */
function ChatBubble({ text: msg, mine }: { text: string; mine: boolean }) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={(mine ? SlideInRight : SlideInLeft).duration(240)}
      exiting={(mine ? SlideOutRight : SlideOutLeft).duration(180)}
      style={[styles.chatBubbleWrap, mine ? styles.chatBubbleMine : styles.chatBubbleTheirs]}
    >
      <View style={[styles.chatToast, !mine && styles.chatToastReply]}>
        <Text style={styles.chatToastText}>
          {mine ? 'Sen: ' : 'Rakip: '}
          {msg}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * One button in the action bar that sits on the halfway line: icon over a
 * short label, like the bottom nav elsewhere in the app. `primary` is the
 * turn button — filled and louder, since it's the one thing you press every
 * single turn; the others are quiet pills that only speak up when opened.
 */
function ActionButton({
  icon,
  label,
  onPress,
  tint = colors.inkSoft,
  primary = false,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  tint?: string;
  primary?: boolean;
}) {
  return (
    <Pressable style={[styles.actionBtn, primary && styles.actionBtnPrimary]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={18} color={primary ? colors.ink : tint} />
      <Text style={[styles.actionBtnText, { color: primary ? colors.ink : tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Long-press result — built like the Card Detail page (art, pills, stats,
 *  abilities) instead of a bare list of sentences. */
function InspectPanel({ data, onClose }: { data: InspectData; onClose: () => void }) {
  const card = getCard(data.cardId);
  const r = RAR[card.rarity];

  return (
    <Pressable style={styles.inspectScrim} onPress={onClose}>
      <Pressable style={styles.inspectPanel} onPress={() => { }}>
        <View style={[styles.inspectHero, { backgroundColor: r.art }]}>
          <Image source={carImage(data.cardId)} style={styles.bvImg} resizeMode="cover" />
          <Pressable style={styles.inspectClose} onPress={onClose}>
            <MaterialCommunityIcons name="close-thick" size={15} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.inspectBody}>
          <Text style={styles.inspectName}>{data.name}</Text>

          <View style={styles.inspectPillRow}>
            <View style={[styles.inspectPill, { backgroundColor: r.pill }]}>
              <RarityStars count={r.stars} color={r.border} size={11} />
              <Text style={[styles.inspectPillText, { color: r.ink }]}>{r.label}</Text>
            </View>
            <View style={[styles.inspectPill, { backgroundColor: colors.sunken }]}>
              <Text style={[styles.inspectPillText, { color: colors.inkSoft }]}>
                {CLASS_LABEL[card.class]}
              </Text>
            </View>
          </View>

          <View style={styles.inspectStatRow}>
            <InspectStat icon="lightning-bolt" tint={colors.accent} label="Güç" value={data.attack} hint={STAT_HINT.attack} />
            <InspectStat icon="chevron-double-right" tint={colors.primary} label="Hız" value={data.speed} hint={STAT_HINT.speed} />
            <InspectStat
              icon="shield"
              tint={colors.success}
              label="Dayanıklılık"
              value={`${data.health}/${data.maxHealth}`}
              hint={STAT_HINT.health}
            />
            <InspectStat icon="water" tint={colors.primaryInk} label="Yakıt" value={data.cost} hint={STAT_HINT.cost} />
          </View>

          {card.abilities.length === 0 ? (
            <Text style={styles.inspectNone}>Özel yeteneği yok. Saf güç.</Text>
          ) : (
            <View style={styles.inspectAbilities}>
              {card.abilities.map((a, i) => (
                <View
                  key={i}
                  style={[
                    styles.inspectAbilityRow,
                    i < card.abilities.length - 1 && styles.inspectAbilityDivider,
                  ]}
                >
                  <View style={styles.inspectDot} />
                  <Text style={styles.inspectLine}>
                    <Text style={styles.inspectLabel}>{abilityShort(a)} </Text>
                    {abilityDesc(a)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Pressable>
  );
}

function InspectStat({
  icon,
  tint,
  label,
  value,
  hint,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <View style={styles.inspectStat}>
      <MaterialCommunityIcons name={icon} size={14} color={tint} />
      <Text style={styles.inspectStatValue}>{value}</Text>
      <Text style={styles.inspectStatLabel}>{label}</Text>
      <Text style={styles.inspectStatHint} numberOfLines={2}>
        {hint}
      </Text>
    </View>
  );
}

interface GarageBarProps {
  label: string;
  hp: number;
  pct: number;
  fuel: string;
  tint: string;
  borderColor: string;
  hitToken?: number;
  /** Vehicles this side has lost so far; the counter is hidden at zero. */
  deadCount?: number;
  onDeadPress?: () => void;
}

/** The bar's visual only, split out from the measuring wrapper below. */
function GarageBarContent({
  label,
  hp,
  pct,
  fuel,
  tint,
  borderColor,
  hitToken = 0,
  deadCount = 0,
  onDeadPress,
}: GarageBarProps) {
  const { shakeStyle, flashStyle } = useHitPulse(hitToken);
  return (
    <Animated.View style={[styles.garage, { borderColor }, shakeStyle]}>
      {/* One centred line instead of name-left / stats-right: with no panel
          behind it any more, a split row read as two unrelated floating
          groups rather than one bar. The scrapyard count belongs on this
          line too — it's a stat about this side like HP and fuel are, and
          the floating badge it used to be had no home in the new arena. */}
      <View style={styles.garageTop}>
        <MaterialCommunityIcons name="home" size={14} color={tint} />
        <Text style={[styles.garageLabel, { color: tint }]}>{label}</Text>
        <View style={[styles.garageSep, { backgroundColor: tint }]} />
        <MaterialCommunityIcons name="heart" size={13} color={colors.danger} />
        <Text style={styles.garageHp}>{hp}</Text>
        <MaterialCommunityIcons name="water" size={13} color={colors.primaryInk} />
        <Text style={styles.garageFuel}>{fuel}</Text>
        {deadCount > 0 ? (
          <Pressable style={styles.garageDead} onPress={onDeadPress} hitSlop={8}>
            <MaterialCommunityIcons name="layers" size={13} color={colors.textMuted} />
            <Text style={styles.garageDeadText}>{deadCount}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.hpTrack}>
        <View style={[styles.hpFill, { width: `${Math.max(0, pct)}%`, backgroundColor: hpColor(pct) }]} />
      </View>
      {/* Just got hit: brief red flash, see useHitPulse */}
      <Animated.View pointerEvents="none" style={[styles.cardFlash, flashStyle]} />
    </Animated.View>
  );
}

function GarageBar(props: GarageBarProps & { registerRect?: (r: Rect) => void; measureTick?: number }) {
  const ref = useRef<View>(null);
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => props.registerRect?.({ x, y, w, h }));
  }, [props.registerRect]);
  // Re-measure whenever measureTick changes — onLayout alone only fires when
  // the bar's own size/position within its parent changes, not when
  // something above it in the tree shifts its window position.
  useEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.measureTick]);
  return (
    <View ref={ref} collapsable={false} onLayout={measure}>
      <GarageBarContent {...props} />
    </View>
  );
}

/** Shared visual body (image + name band + power/hp badges) for the player
 *  card and its drag ghost, so they stay pixel-identical. */
/**
 * Sahadaki kartın yüzü: ad üstte nadirlik şeridinde, altta tek sıra hâlinde
 * güç · hız · dayanıklılık.
 *
 * Yakıt burada YOK: kart sahaya çıktığı anda maliyeti ödendi ve bir daha
 * hiçbir kararı etkilemiyor. Dörtten üçe inince rozetler 23'ten 30 px'e
 * çıktı — en dar ekranda (84 px kart) bile 26 px kalıyor, dört rozetle
 * 20 px'e düşüyordu ve iki haneli sayılar sıkışıyordu.
 */
function VehicleFace({
  cardId,
  name,
  attack,
  speed,
  health,
  hurt,
  width,
}: {
  cardId: string;
  name: string;
  attack: number;
  speed: number;
  health: number;
  /** Dayanıklılığı üçte birin altına düşmüş: rozetin rengi değil, çerçevesi uyarıyor. */
  hurt: boolean;
  width: number;
}) {
  const badge = Math.max(24, Math.round(width * 0.27));
  return (
    <>
      <Image source={carImage(cardId)} style={styles.bvImg} resizeMode="cover" />
      <CardNameBar cardId={cardId} name={name} fontSize={12} />
      <View style={styles.bvStatRow}>
        <StatBadge icon="lightning-bolt" tint={colors.accent} value={attack} size={badge} />
        <StatBadge icon="chevron-double-right" tint={colors.primary} value={speed} size={badge} />
        <StatBadge
          icon="shield"
          tint={colors.success}
          value={health}
          size={badge}
          ring={hurt ? colors.danger : undefined}
          markInset={4}
        />
      </View>
    </>
  );
}

/** Looping diagonal light sweep on a rare+ card, the whole time it's on
 *  board — a "this one's special" holo cue, not a one-off entrance flourish.
 *  Relies on the card's own `overflow: hidden` (styles.bv) to stay clipped
 *  to its bounds, no measuring needed. */
function CardShine() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
        withDelay(1800, withTiming(0, { duration: 1 })),
      ),
      -1,
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (t.value - 0.5) * 260 }, { rotate: '18deg' }],
    opacity: Math.max(0, 1 - Math.abs(t.value - 0.5) * 2),
  }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.shineBar, style]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Enemy board card — a static drop target. No tap-to-attack any more; it
 *  only reports its own screen rect (for hit-testing) and opens the ability
 *  inspector on long-press. */
function EnemyVehicleCard({
  v,
  size,
  targetable,
  blocked,
  onInspect,
  registerRect,
  measureTick,
  hitToken = 0,
  highlightToken = 0,
}: {
  v: Vehicle;
  size: { width: number; height: number };
  targetable?: boolean;
  blocked?: boolean;
  onInspect: () => void;
  registerRect: (r: Rect) => void;
  measureTick?: number;
  hitToken?: number;
  highlightToken?: number;
}) {
  const ref = useRef<View>(null);
  const r = rarOf(v.cardId);
  const pct = Math.round((v.health / Math.max(1, v.maxHealth)) * 100);
  const atk = v.attack + v.tempAttack;
  const { shakeStyle, flashStyle } = useHitPulse(hitToken);
  const emphasisStyle = useEmphasisPulse(highlightToken);
  const spawn = useSpawnDrop(true);
  // A rare+ card keeps a slow looping shine the whole time it's on board,
  // and gets a one-off burst in its rarity colour as it arrives.
  const rarityKey = getCard(v.cardId).rarity;
  const showShine = rarityKey !== 'common';
  const auraSparks = spawnSparkCount(rarityKey);

  // Kenar her zaman nadirlik. Sürüklenen kartın geçerli hedefiyse dışına
  // kırmızı halka çıkıyor; geçersizse kartın üstü hafifçe karartılıyor
  // (styles.cardDim) — o karartma anlık bir sürükleme geri bildirimi,
  // kartın kalıcı durumu değil.
  const ringColor = targetable ? TARGET_RING : null;

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      registerRect({ x, y, w, h });
      spawn.onMeasured(x + w / 2, y + h / 2);
    });
  }, [registerRect, spawn]);
  // Re-measure on measureTick (see GarageBar above) — this card's window
  // position can move even when its own layout relative to its parent
  // never changes.
  useEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureTick]);

  return (
    // A plain View (not the Pressable below) owns the measurement — more
    // reliable across platforms than relying on Pressable's ref forwarding,
    // and Android won't flatten/optimize away a collapsable={false} view.
    <View ref={ref} collapsable={false} onLayout={measure} style={spawn.elevated && styles.spawning}>
      <Animated.View style={[shakeStyle, emphasisStyle, spawn.style]}>
        {spawn.elevated && auraSparks > 0 ? (
          <SpawnAura tint={r.border} size={size} sparks={auraSparks} />
        ) : null}
        <Pressable
          onLongPress={onInspect}
          delayLongPress={LONG_PRESS_MS}
          style={[styles.bv, size, { borderColor: r.border, backgroundColor: r.art }]}
        >
          <VehicleFace
            cardId={v.cardId}
            name={v.name}
            attack={atk}
            speed={v.speed}
            health={v.health}
            hurt={pct <= 33}
            width={size.width}
          />
          {/* Attack-mode, not a valid target: dim locally instead of the old
              full-screen overlay — no coordinates to keep in sync, and it
              scrolls naturally since it's a normal child of the card. */}
          {blocked ? <View pointerEvents="none" style={styles.cardDim} /> : null}
          {/* Just got hit: brief red flash, see useHitPulse */}
          <Animated.View pointerEvents="none" style={[styles.cardFlash, flashStyle]} />
          {showShine ? <CardShine /> : null}
        </Pressable>
        {ringColor ? <View pointerEvents="none" style={[styles.stateRing, { borderColor: ringColor }]} /> : null}
      </Animated.View>
    </View>
  );
}

/** Player board card — drag it onto an enemy (or the enemy garage) to attack.
 *  Long-press still inspects; tapping a black-bordered (spent) one explains why. */
function PlayerVehicleCard({
  v,
  size,
  canAttack,
  isDragging,
  targetable,
  blocked,
  dragOriginX,
  dragOriginY,
  dragTx,
  dragTy,
  onDragStart,
  onDragEnd,
  onBlocked,
  onInspect,
  registerRect,
  measureTick,
  hitToken = 0,
}: {
  v: Vehicle;
  size: { width: number; height: number };
  canAttack: boolean;
  isDragging: boolean;
  /** Set while a targeted Pit Ekibi card is being dragged and this vehicle is
   *  (or isn't) a legal drop for it — same idea as EnemyVehicleCard's props,
   *  just needed here too now that support cards can target your own side. */
  targetable?: boolean;
  blocked?: boolean;
  dragOriginX: SharedValue<number>;
  dragOriginY: SharedValue<number>;
  dragTx: SharedValue<number>;
  dragTy: SharedValue<number>;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onBlocked: () => void;
  onInspect: () => void;
  registerRect: (r: Rect) => void;
  measureTick?: number;
  hitToken?: number;
}) {
  const ref = useRef<View>(null);
  const r = rarOf(v.cardId);
  const pct = Math.round((v.health / Math.max(1, v.maxHealth)) * 100);
  const atk = v.attack + v.tempAttack;
  const dragging = useSharedValue(0);
  const halfW = size.width / 2;
  const halfH = size.height / 2;
  const { shakeStyle, flashStyle } = useHitPulse(hitToken);
  const spawn = useSpawnDrop(true);
  const rarityKey = getCard(v.cardId).rarity;
  const showShine = rarityKey !== 'common';
  const auraSparks = spawnSparkCount(rarityKey);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      registerRect({ x, y, w, h });
      spawn.onMeasured(x + w / 2, y + h / 2);
    });
  }, [registerRect, spawn]);
  // Registered so the bot can land an impact effect on this exact spot —
  // same re-measure-on-scroll reasoning as EnemyVehicleCard/GarageBar.
  useEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureTick]);

  // The ghost (rendered elsewhere) is what actually follows the finger — it
  // reads dragOriginX/Y + dragTx/Ty directly, all mutated here on the UI
  // thread with no JS bridging per frame. This card just hides itself.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canAttack)
        .onStart((e) => {
          dragging.value = 1;
          dragOriginX.value = e.absoluteX - halfW;
          dragOriginY.value = e.absoluteY - halfH;
          dragTx.value = 0;
          dragTy.value = 0;
          runOnJS(onDragStart)();
        })
        .onUpdate((e) => {
          dragTx.value = e.translationX;
          dragTy.value = e.translationY;
        })
        .onEnd((e) => {
          dragging.value = 0;
          runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
        }),
    [canAttack, onDragStart, onDragEnd, dragging, dragOriginX, dragOriginY, dragTx, dragTy, halfW, halfH],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(280)
        .onEnd(() => {
          if (!canAttack) runOnJS(onBlocked)();
        }),
    [canAttack, onBlocked],
  );

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MS)
        .onStart(() => {
          runOnJS(onInspect)();
        }),
    [onInspect],
  );

  const gesture = Gesture.Race(pan, longPress, tap);

  const aStyle = useAnimatedStyle(() => ({
    opacity: dragging.value ? 0 : 1, // the ghost takes over while dragging
  }));

  // Kenar nadirlikten geliyor; "bu araç bu tur saldırabilir" bilgisi dış
  // yeşil halkada. Sürüklenirken mavi, bir pit kartının geçerli hedefiyse
  // kırmızı oluyor — üçü de aynı halkayı kullanıyor, kartın kimliği hiç
  // değişmiyor.
  let ringColor: string | null = null;
  if (isDragging) ringColor = ARMED_RING;
  else if (targetable) ringColor = TARGET_RING;
  else if (canAttack) ringColor = READY_RING;

  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={spawn.elevated && styles.spawning}>
      <Animated.View style={[shakeStyle, spawn.style]}>
        {spawn.elevated && auraSparks > 0 ? (
          <SpawnAura tint={r.border} size={size} sparks={auraSparks} />
        ) : null}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.bv, size, { borderColor: r.border, backgroundColor: r.art }, aStyle]}>
            <VehicleFace
              cardId={v.cardId}
              name={v.name}
              attack={atk}
              speed={v.speed}
              health={v.health}
              hurt={pct <= 33}
              width={size.width}
            />
            {/* Pit Ekibi drag in progress, not a legal target: dim locally,
                same as EnemyVehicleCard does for an attack drag. */}
            {blocked ? <View pointerEvents="none" style={styles.cardDim} /> : null}
            {/* Just got hit: brief red flash, see useHitPulse */}
            <Animated.View pointerEvents="none" style={[styles.cardFlash, flashStyle]} />
            {showShine ? <CardShine /> : null}
          </Animated.View>
        </GestureDetector>
        {ringColor ? (
          <Animated.View pointerEvents="none" style={[styles.stateRing, { borderColor: ringColor }, aStyle]} />
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Floating duplicate of the dragged vehicle, rendered above the full-screen
 *  dim and driven purely by shared values (no re-renders while dragging). */
function DragGhost({
  v,
  size,
  originX,
  originY,
  tx,
  ty,
}: {
  v: Vehicle;
  size: { width: number; height: number };
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}) {
  const r = rarOf(v.cardId);
  const pct = Math.round((v.health / Math.max(1, v.maxHealth)) * 100);
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: originX.value + tx.value,
    top: originY.value + ty.value,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bv, styles.ghost, size, { borderColor: r.border, backgroundColor: r.art }, style]}
    >
      <VehicleFace
        cardId={v.cardId}
        name={v.name}
        attack={v.attack + v.tempAttack}
        speed={v.speed}
        health={v.health}
        hurt={pct <= 33}
        width={size.width}
      />
    </Animated.View>
  );
}

/** Clamped 0..1 progress within a sub-window [a,b] of a master 0..1 value —
 *  lets each layer of the burst (flash/sparks/debris/smoke) run its own
 *  timing off one shared "progress" instead of juggling separate clocks. */
function remap(t: number, a: number, b: number) {
  'worklet';
  if (b <= a) return t >= b ? 1 : 0;
  const v = (t - a) / (b - a);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const CRASH_HOT = '#FFC94A'; // hottest sparks

/** A cartoon crash — not a magic poof: a hot flash core, an expanding
 *  shockwave ring, sparks flying outward, a few tumbling dark debris chunks,
 *  and slower smoke puffs that linger after everything else has faded. All
 *  vector shapes on one shared `progress` value (no art asset needed), and
 *  still one-shot — born at (x, y), animates, unmounts via onDone — so it
 *  never needs to track a live position like the old dim/ghost system did. */
function ImpactBurst({ x, y, kind, onDone }: { x: number; y: number; kind: Impact['kind']; onDone: () => void }) {
  const progress = useSharedValue(0);
  const big = kind === 'garage';
  const mainColor = big ? colors.dangerInk : colors.danger;
  const reach = big ? 46 : 32;
  const ringSize = big ? 70 : 50;
  const flashSize = big ? 40 : 30;
  const sparkCount = big ? 10 : 8;
  const debrisCount = big ? 4 : 3;
  const smokeCount = big ? 4 : 3;

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: big ? 720 : 540, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The instant white-hot pop that sells "impact" before the fire/smoke
  // takes over — done in the first ~20% of the whole animation.
  const flashStyle = useAnimatedStyle(() => {
    const t = remap(progress.value, 0, 0.22);
    return { opacity: 1 - t, transform: [{ scale: 0.4 + t * 0.9 }] };
  });
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 0.3 + progress.value * (big ? 2.1 : 1.6) }],
  }));

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y }}>
      {/* smoke first (renders behind everything else) */}
      {Array.from({ length: smokeCount }, (_, i) => (
        <SmokePuff key={`s${i}`} seed={i} progress={progress} reach={reach} />
      ))}
      <Animated.View
        style={[
          styles.impactRing,
          { borderColor: mainColor, width: ringSize, height: ringSize, marginLeft: -ringSize / 2, marginTop: -ringSize / 2 },
          ringStyle,
        ]}
      />
      {Array.from({ length: debrisCount }, (_, i) => (
        <DebrisChunk key={`d${i}`} seed={i} progress={progress} reach={reach} />
      ))}
      {Array.from({ length: sparkCount }, (_, i) => (
        <Spark
          key={`k${i}`}
          angle={(i / sparkCount) * Math.PI * 2 + (i % 2 ? 0.22 : -0.22)}
          progress={progress}
          reach={reach + (i % 3) * 6}
          color={i % 3 === 0 ? CRASH_HOT : mainColor}
        />
      ))}
      <Animated.View
        style={[
          styles.impactFlash,
          { backgroundColor: '#FFF3D6', width: flashSize, height: flashSize, marginLeft: -flashSize / 2, marginTop: -flashSize / 2 },
          flashStyle,
        ]}
      />
    </View>
  );
}

/** A single hot spark flying outward and shrinking as it goes. */
function Spark({
  angle,
  progress,
  color,
  reach,
}: {
  angle: number;
  progress: SharedValue<number>;
  color: string;
  reach: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = remap(progress.value, 0, 0.85);
    const d = t * reach;
    return {
      opacity: 1 - t,
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d },
        { rotate: `${angle}rad` },
        { scaleY: 1 - t * 0.3 },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.impactShard, { backgroundColor: color }, style]} />;
}

/** A dark tumbling chunk — "broken car part" texture, distinct from the
 *  bright sparks: it spins, drifts less far, and sags slightly (gravity). */
function DebrisChunk({ seed, progress, reach }: { seed: number; progress: SharedValue<number>; reach: number }) {
  const angle = (seed * 2.4 + 0.6) % (Math.PI * 2);
  const spin = seed % 2 === 0 ? 1 : -1;
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const d = t * reach * 0.8;
    return {
      opacity: 1 - t,
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d + t * 10 },
        { rotate: `${t * 6 * spin}rad` },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.impactDebris, style]} />;
}

/** A soft puff that drifts upward and lingers longer than the sparks/debris —
 *  the "just exploded" afterimage. */
function SmokePuff({ seed, progress, reach }: { seed: number; progress: SharedValue<number>; reach: number }) {
  const angle = seed * 1.9 + 0.4;
  const style = useAnimatedStyle(() => {
    const t = remap(progress.value, 0.05, 1);
    const d = t * reach * 0.35;
    return {
      opacity: (1 - t) * 0.6,
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d - t * 14 },
        { scale: 0.5 + t * 0.9 },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.impactSmoke, style]} />;
}

function HandCard({
  card,
  affordable,
  rot,
  lift,
  overlap,
  onPlay,
  onBlocked,
  onInspect,
}: {
  card: { uid: string; cardId: string; name: string; cost: number; attack: number; health: number };
  affordable: boolean;
  rot: number;
  lift: number;
  overlap: number;
  /** Gets where the card was let go: with a full board that decides which of
   *  your vehicles gets scrapped for it. */
  onPlay: (dropX: number, dropY: number) => void;
  onBlocked: () => void;
  onInspect: () => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const active = useSharedValue(0);
  const arm = useSharedValue(0);
  const r = rarOf(card.cardId);

  // Only the vertical distance decides whether it plays (drag it up past
  // PLAY_THRESHOLD) — horizontal is purely visual, so the card can be lifted
  // out of the fan and carried anywhere while you decide.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(affordable)
        .onStart(() => {
          active.value = 1;
        })
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = Math.min(0, e.translationY);
          arm.value = e.translationY < PLAY_THRESHOLD ? 1 : 0;
        })
        .onEnd((e) => {
          if (e.translationY < PLAY_THRESHOLD) runOnJS(onPlay)(e.absoluteX, e.absoluteY);
          tx.value = withSpring(0, { damping: 18 });
          ty.value = withSpring(0, { damping: 18 });
          active.value = 0;
          arm.value = 0;
        }),
    [affordable, onPlay, active, arm, tx, ty],
  );

  // A quick tap that isn't a drag: explain why a black-bordered card can't be
  // played, or open the ability inspector for a green one.
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(280)
        .onEnd(() => {
          if (!affordable) runOnJS(onBlocked)();
        }),
    [affordable, onBlocked],
  );
  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MS)
        .onStart(() => {
          runOnJS(onInspect)();
        }),
    [onInspect],
  );

  const gesture = Gesture.Race(pan, longPress, tap);

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: lift + ty.value },
      { rotate: `${active.value ? 0 : rot}deg` },
      // A bigger pop once armed to play (1.08) than a plain lift (1.03) —
      // the card visibly "commits" the instant it crosses the threshold.
      { scale: 1 + active.value * (0.03 + arm.value * 0.05) },
    ],
    zIndex: active.value ? 60 : 1,
  }));
  // Yeşil halka = şimdi oynanabilir, mavi = bırakılırsa oynanacak. Halka
  // kartın dışında duruyor, kenar nadirliğin rengi olarak kalıyor.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: arm.value || affordable ? 1 : 0,
    borderColor: arm.value ? ARMED_RING : READY_RING,
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: arm.value }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.handCardWrap, { marginLeft: overlap }, aStyle]}>
        <Animated.Text style={[styles.handPlayHint, labelStyle]}>BIRAK</Animated.Text>
        <Animated.View pointerEvents="none" style={[styles.handRing, ringStyle]} />
        <View style={[styles.handCard, { borderColor: r.border, backgroundColor: r.art }]}>
          <Image source={carImage(card.cardId)} style={styles.bvImg} resizeMode="cover" />
          <CardNameBar cardId={card.cardId} name={card.name} fontSize={12} />
          {/* Elde tek soru var: bunu şimdi oynayabilir miyim? Cevabını yakıt
              veriyor, o yüzden elde başka rozet yok — ve yakıt rozeti yetersiz
              yakıtta griye DÖNMÜYOR: aynı sayının iki renkte görünmesi
              "kartın yakıtı değişti" gibi okunuyordu. */}
          <View style={styles.hcCost}>
            <StatBadge icon="water" tint={colors.primaryInk} value={card.cost} size={HC_BADGE} />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** A Pit Ekibi card in hand — same footprint as HandCard but no drag: it
 *  never boards, so there's nowhere to "drop" it. A tap either fires it right
 *  away (target: 'none') or opens the target picker (see below). */
/** A Pit Ekibi card in hand. Same drag habit as everything else in the hand:
 *  untargeted cards (target: 'none') drag straight up to play, exactly like a
 *  vehicle; targeted ones drag onto the actual vehicle they affect, reusing
 *  the board's ghost + hit-test machinery so it feels like the attack drag. */
function SupportHandCard({
  card,
  usable,
  rot,
  lift,
  overlap,
  dragOriginX,
  dragOriginY,
  dragTx,
  dragTy,
  onPlayUntargeted,
  onDragStart,
  onDragEnd,
  onBlocked,
  onInspect,
}: {
  card: SupportBattleCard;
  usable: boolean;
  rot: number;
  lift: number;
  overlap: number;
  dragOriginX: SharedValue<number>;
  dragOriginY: SharedValue<number>;
  dragTx: SharedValue<number>;
  dragTy: SharedValue<number>;
  onPlayUntargeted: () => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onBlocked: () => void;
  onInspect: () => void;
}) {
  const targeted = card.target !== 'none';
  const halfW = HC_W / 2;
  const halfH = HC_H / 2;

  // Untargeted: local "drag up past a line to fire" — identical feel to a
  // vehicle HandCard, since there's nowhere specific to aim.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const active = useSharedValue(0);
  const arm = useSharedValue(0);
  const localPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(usable && !targeted)
        .onStart(() => {
          active.value = 1;
        })
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = Math.min(0, e.translationY);
          arm.value = e.translationY < PLAY_THRESHOLD ? 1 : 0;
        })
        .onEnd((e) => {
          if (e.translationY < PLAY_THRESHOLD) runOnJS(onPlayUntargeted)();
          tx.value = withSpring(0, { damping: 18 });
          ty.value = withSpring(0, { damping: 18 });
          active.value = 0;
          arm.value = 0;
        }),
    [usable, targeted, onPlayUntargeted, active, arm, tx, ty],
  );

  // Targeted: absolute-position drag onto a board card, mirroring
  // PlayerVehicleCard's attack drag (same shared dragOrigin/dragT values).
  const dragging = useSharedValue(0);
  const targetedPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(usable && targeted)
        .onStart((e) => {
          dragging.value = 1;
          dragOriginX.value = e.absoluteX - halfW;
          dragOriginY.value = e.absoluteY - halfH;
          dragTx.value = 0;
          dragTy.value = 0;
          runOnJS(onDragStart)();
        })
        .onUpdate((e) => {
          dragTx.value = e.translationX;
          dragTy.value = e.translationY;
        })
        .onEnd((e) => {
          dragging.value = 0;
          runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
        }),
    [usable, targeted, onDragStart, onDragEnd, dragging, dragOriginX, dragOriginY, dragTx, dragTy, halfW, halfH],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(280)
        .onEnd(() => {
          if (!usable) runOnJS(onBlocked)();
        }),
    [usable, onBlocked],
  );
  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MS)
        .onStart(() => {
          runOnJS(onInspect)();
        }),
    [onInspect],
  );

  const gesture = Gesture.Race(localPan, targetedPan, longPress, tap);

  // Same zIndex rule as a vehicle HandCard (resting 1, lifted 60 while
  // actively dragged) — missing this on the support card is what made it
  // render behind/in front of its neighbours at random.
  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: lift + ty.value },
      { rotate: `${active.value ? 0 : rot}deg` },
      { scale: 1 + active.value * (0.03 + arm.value * 0.05) },
    ],
    zIndex: active.value ? 60 : 1,
    opacity: dragging.value ? 0 : 1, // the ghost takes over while dragging
  }));
  // Vehicle HandCard ile aynı dil: kenar kartın kendi kimliği (pit kartları
  // için mor), yeşil halka "şimdi kullanabilirsin".
  const ringStyle = useAnimatedStyle(() => ({
    opacity: arm.value || usable ? 1 : 0,
    borderColor: arm.value ? ARMED_RING : READY_RING,
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: arm.value }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.handCardWrap, { marginLeft: overlap }, aStyle]}>
        <Animated.Text style={[styles.handPlayHint, labelStyle]}>BIRAK</Animated.Text>
        <Animated.View pointerEvents="none" style={[styles.handRing, ringStyle]} />
        <View style={[styles.handCard, styles.supportHandCard, { borderColor: colors.grape }]}>
          <Text style={styles.supportEmoji}>{card.emoji}</Text>
          <Text style={styles.supportName} numberOfLines={1}>
            {card.name}
          </Text>
          <View style={styles.supportBadge}>
            <MaterialCommunityIcons name="wrench" size={8} color="#FFFFFF" />
            <Text style={styles.supportBadgeText}>PİT</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Floating duplicate of a dragged Pit Ekibi card — same idea as DragGhost,
 *  just for the much simpler support-card face. */
function SupportDragGhost({
  card,
  originX,
  originY,
  tx,
  ty,
}: {
  card: SupportBattleCard;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: originX.value + tx.value,
    top: originY.value + ty.value,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.handCard, styles.supportHandCard, styles.ghost, { borderColor: colors.grape }, style]}
    >
      <Text style={styles.supportEmoji}>{card.emoji}</Text>
      <Text style={styles.supportName} numberOfLines={1}>
        {card.name}
      </Text>
      <View style={styles.supportBadge}>
        <MaterialCommunityIcons name="wrench" size={8} color="#FFFFFF" />
        <Text style={styles.supportBadgeText}>PİT</Text>
      </View>
    </Animated.View>
  );
}

/** Long-press inspector for a Pit Ekibi card — same chrome as InspectPanel
 *  (see above) but for the support card's much simpler shape: an icon and a
 *  single effect sentence instead of stats/rarity/abilities. */
function SupportInspectPanel({ card, onClose }: { card: SupportBattleCard; onClose: () => void }) {
  return (
    <Pressable style={styles.inspectScrim} onPress={onClose}>
      <Pressable style={styles.inspectPanel} onPress={() => { }}>
        <View style={[styles.inspectHero, styles.supportInspectHero]}>
          <Text style={styles.supportInspectEmoji}>{card.emoji}</Text>
          <Pressable style={styles.inspectClose} onPress={onClose}>
            <MaterialCommunityIcons name="close-thick" size={15} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.inspectBody}>
          <Text style={styles.inspectName}>{card.name}</Text>
          <View style={styles.inspectPillRow}>
            <View style={[styles.inspectPill, { backgroundColor: colors.grapeSoft }]}>
              <MaterialCommunityIcons name="wrench" size={11} color={colors.grapeInk} />
              <Text style={[styles.inspectPillText, { color: colors.grapeInk }]}>Pit Ekibi</Text>
            </View>
          </View>
          <Text style={styles.inspectNone}>
            {supportCardEffectText({ kind: card.ability, value: card.value })}
          </Text>
        </View>
      </Pressable>
    </Pressable>
  );
}

/** List of everything destroyed on one side so far — tap the graveyard pill
 *  in that zone to open it. Reuses the same scrim as InspectPanel. */
function GraveyardModal({
  side,
  cards,
  onClose,
}: {
  side: 'bot' | 'player';
  cards: { cardId: string; name: string }[];
  onClose: () => void;
}) {
  return (
    <Pressable style={styles.inspectScrim} onPress={onClose}>
      <Pressable style={styles.graveyardPanel} onPress={() => { }}>
        <View style={styles.graveyardHeader}>
          <Text style={styles.graveyardTitle}>
            {side === 'bot' ? 'Rakibin Hurdalığı' : 'Senin Hurdalığın'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <MaterialCommunityIcons name="close-thick" size={18} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView style={styles.graveyardList}>
          {cards.map((c, i) => (
            <View key={i} style={styles.graveyardRow}>
              <Image source={carImage(c.cardId)} style={styles.graveyardImg} resizeMode="cover" />
              <Text style={styles.graveyardName}>{c.name}</Text>
            </View>
          ))}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  // SafeAreaView/ScrollView stay transparent so the full-screen arena
  // (painted behind them on the outer `fill` view) shows through every gap —
  // only individual chips/cards/panels are opaque on top of it.
  screen: { flex: 1 },
  // The two halves: opponent above, you below, meeting exactly at mid-screen.
  // Two separate 50% blocks rather than one four-stop gradient so the seam
  // stays put at any screen height instead of drifting with the stops.
  // Heights come in from ArenaBackdrop (ARENA_SPLIT_RATIO), not from here.
  arenaHalfTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  arenaHalfBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  // The oval table over the seam. Cream, like every other surface in the
  // light theme, so the white cards and bars on top keep the same contrast
  // they had against the old backdrop.
  arenaTable: {
    position: 'absolute',
    backgroundColor: colors.bg,
    borderWidth: ARENA_RIM,
    borderColor: ARENA_LINE,
    overflow: 'hidden',
  },
  arenaTableTint: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  arenaTableTintBottom: { top: undefined, bottom: 0 },
  // Same white and same thickness as the rim above, so the markings look
  // painted on one pitch rather than three separate decorations. `top` and
  // `left` are supplied by ArenaBackdrop in screen coordinates.
  arenaMidline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ARENA_RIM,
    backgroundColor: ARENA_LINE,
  },
  arenaCentreCircle: {
    position: 'absolute',
    borderWidth: ARENA_RIM,
    borderColor: ARENA_LINE,
  },
  // paddingBottom is applied inline from the drawer's measured height, so the
  // gap under "TURU BİTİR" is exactly the same as the left/right padding.
  scroll: { padding: space.md, gap: 10 },

  // marginBottom pushes everything under the header down by ARENA_DROP, the
  // same nudge the painted pitch gets — the two have to move together or the
  // boards stop sitting inside their own halves.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ARENA_DROP,
  },
  // Both header buttons are the same round chip now — one on each side, no
  // label on either, so the two ends of the row balance.
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },

  // The action bar on the halfway line. Thirds rather than content-width
  // buttons: a label that changes ("Mesaj Yaz" → "Kapat") would otherwise
  // shrink its own button and shove the other two sideways.
  // Fixed-height reservation; the row inside it is what comes and goes.
  actionBar: { height: 44, justifyContent: 'center', marginVertical: 2 },
  actionBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  actionBtnPrimary: { backgroundColor: colors.accent },
  actionBtnText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize },
  // One tooltip container holding both the hint and the preference — not two
  // stacked cards, and no scale animation: it just appears under its button.
  helpTip: {
    width: 288,
    padding: 12,
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.raised,
  },
  helpTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  helpTipText: {
    flex: 1,
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.accentInk,
  },
  // Auto-end-turn, now a labelled row inside the tooltip rather than a
  // cryptic "OTO" switch riding on the turn button.
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  autoRowLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.inkSoft },

  zone: { gap: 8, position: 'relative' },
  // Only while that side is mid-spawn — see spawnSide.
  zoneElevated: { zIndex: 30 },
  // Scrapyard count, inline in the garage bar — tap to see which vehicles
  // that side has lost. Was a floating badge pinned to the zone's corner.
  garageDead: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 },
  garageDeadText: { fontFamily: font.stat, fontSize: text.bodySmall.fontSize, color: colors.textMuted },
  graveyardPanel: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
    ...shadow.raised,
  },
  graveyardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  graveyardTitle: { fontFamily: font.display, fontSize: 18, color: colors.ink },
  graveyardList: { gap: 8 },
  graveyardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
    marginBottom: 8,
  },
  graveyardImg: { width: 36, height: 36, borderRadius: 8 },
  graveyardName: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.ink },

  // No panel and no border by default any more: the bar sits straight on the
  // arena floor. The border is still here but transparent — it turns red only
  // while the garage is a legal drop target, which is the one moment it
  // actually has something to say.
  garage: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  garageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  garageLabel: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, letterSpacing: 0.3 },
  // Hairline dot between the name and the numbers — enough to group them
  // without a full divider.
  garageSep: { width: 3, height: 3, borderRadius: 2, opacity: 0.5, marginHorizontal: 3 },
  garageFuel: { fontFamily: font.stat, fontSize: text.bodySmall.fontSize, color: colors.primaryInk },
  garageHp: { fontFamily: font.stat, fontSize: text.bodySmall.fontSize, color: colors.ink, marginRight: 4 },
  // Translucent ink instead of the theme's opaque `sunken`: the channel now
  // shows the arena through it rather than sitting on a white card.
  hpTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(30,36,54,0.13)',
    overflow: 'hidden',
    marginTop: 7,
  },
  hpFill: { height: '100%', borderRadius: 999 },

  boardRow: {
    // Above the garage bar that follows it in the player's own zone, so a
    // card blowing up on arrival isn't painted behind it.
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: BOARD_CARD_GAP,
    minHeight: 118,
    alignItems: 'center',
    paddingVertical: 4,
  },
  // Only the hand uses this now — both board rows show an EmptySlot outline
  // instead of a sentence. White-ish for the same reason as handLabel above.
  handEmpty: {
    fontFamily: font.body,
    fontSize: text.bodySmall.fontSize,
    color: 'rgba(255,255,255,0.78)',
    paddingVertical: 20,
  },
  // Empty board slot — same footprint and corner radius as a real board card
  // (styles.bv) so the row doesn't resize when the first vehicle lands on it.
  // Dashed, unlike the reference's solid outlines: here it's standing in for
  // a "drag a card here" instruction, not just decorating a bench.
  emptySlot: {
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Board card while its arrival animation is oversized — lifts it over the
  // neighbouring slots for those few frames only.
  spawning: { zIndex: 25 },
  // Rare+ arrival burst. All three are centred on the card with 50% + a
  // negative margin; the parent here has no border, so percentages land
  // where you'd expect (unlike the arena table, see ArenaBackdrop).
  auraGlow: { position: 'absolute', left: '50%', top: '50%' },
  auraRing: { position: 'absolute', left: '50%', top: '50%', borderWidth: 3 },
  auraSpark: { position: 'absolute', left: '50%', top: '50%', marginLeft: -7, marginTop: -7 },
  emptySlotEnemy: { borderColor: 'rgba(194,44,41,0.30)', backgroundColor: 'rgba(240,74,71,0.06)' },
  emptySlotOwn: { borderColor: 'rgba(46,98,200,0.40)', backgroundColor: 'rgba(58,123,240,0.08)' },

  bv: {
    // width/height come from the responsive `size` prop, not this static sheet.
    borderWidth: 3,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  ghost: { zIndex: 200, ...shadow.raised },
  // Oversized on purpose (negative top/bottom, wide) — the card's own
  // overflow:hidden clips it, so it doesn't need to match any exact size.
  shineBar: { position: 'absolute', top: -40, bottom: -40, left: '50%', width: 26, marginLeft: -13 },
  impactRing: { position: 'absolute', borderRadius: 999, borderWidth: 3, zIndex: 210 },
  impactShard: { position: 'absolute', width: 7, height: 10, borderRadius: 2, zIndex: 211 },
  impactFlash: { position: 'absolute', borderRadius: 999, zIndex: 212 },
  impactDebris: { position: 'absolute', width: 6, height: 6, borderRadius: 1, backgroundColor: '#3A3F52', zIndex: 209 },
  impactSmoke: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(88,90,102,0.55)',
    zIndex: 208,
  },
  // Whole-screen "you felt that" flash on a landed hit — warm, brief, and
  // non-interactive; sits above the arena backdrop but below every card/HUD
  // element's own opaque surface, so it reads as lighting, not a wall.
  screenFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFE9B8',
    zIndex: 5,
  },
  bvImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  // Ad şeridi: zemini nadirliğin rengi. Eskiden yarı saydam siyahtı ve
  // nadirlik yalnızca ince kenardan okunuyordu — savaşta hiç görülmüyordu.
  nameBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 5,
    paddingTop: 3,
    paddingBottom: 2,
    alignItems: 'center',
    gap: 1,
  },
  nameBarText: { fontFamily: font.headingSm, includeFontPadding: false },
  bvStatRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  // Rozet: ikon filigran olarak arkada (%30), rakam üstünde gölgeli.
  statBadgeShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  statBadgeMark: { position: 'absolute', opacity: 0.3 },
  statBadgeText: {
    fontFamily: font.stat,
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // "Şu an bunu yapabilirsin" halkası. Sahada kalın ve kartın 3 px dışında:
  // orada kartlar birbirine değmiyor ve halkanın uzaktan seçilmesi gerekiyor.
  stateRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 3,
    borderRadius: 18,
  },
  // Elde ise kartın kenarına yapışık ve 1 px: eldeki kartların hepsi
  // çoğunlukla oynanabilir oluyor, kalın halka bütün desteyi yeşile
  // boyuyordu. İnce çizgi yeterince söylüyor.
  handRing: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderRadius: 15,
  },

  resultScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,18,28,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 250,
    padding: space.xl,
  },
  resultPanel: {
    width: '100%',
    maxWidth: 320,
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 12,
    ...shadow.raised,
  },
  resultText: { fontFamily: font.display, fontSize: 24 },
  resultReward: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  resultRewardPlus: { fontFamily: font.stat, fontSize: 17, color: colors.primaryInk },
  guestOffer: { width: '100%', gap: 10, marginTop: 4 },
  guestMissed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
  },
  guestMissedText: {
    flex: 1,
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    lineHeight: text.bodySmall.lineHeight,
    color: colors.inkSoft,
  },
  guestSkip: { height: 40, alignItems: 'center', justifyContent: 'center' },
  guestSkipText: { fontFamily: font.bodyBold, fontSize: text.body.fontSize, color: colors.textMuted },
  resultOffline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resultOfflineText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.textMuted },
  resultBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  resultBtnAlt: { backgroundColor: colors.primarySoft },
  resultBtnText: { fontFamily: font.bodyBold, fontSize: text.body.fontSize, color: '#FFFFFF' },


  // Just the switch itself now — the label lives in the help panel's row.
  autoSwitchTrack: {
    width: 28,
    height: 16,
    borderRadius: 8,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30,36,54,0.22)',
  },
  autoSwitchTrackOn: { alignItems: 'flex-end', backgroundColor: colors.successInk },
  autoSwitchKnob: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },

  // Board lock overlay — sits above everything else in the battle content,
  // below the InfoSweep itself (which needs to stay crisp/unblurred).
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 210,
  },
  // width:'100%' + justifyContent:'center' rather than relying on the
  // parent's alignItems:'center' to shrink-wrap-and-center this — same
  // percentage-width-needs-a-definite-parent lesson as turnBannerBar/barStyle
  // above; without it this row was landing left-aligned in practice.
  sweepTextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, width: '100%' },
  sweepText: {
    fontFamily: font.bodyBold,
    fontSize: text.body.fontSize,
    lineHeight: text.body.lineHeight,
    textAlign: 'center',
    flexShrink: 1,
  },
  // The "**...**" run inside a combat line (the actual hasar number) —
  // heavier weight + a touch bigger, color inherited from the parent Text.
  sweepTextEmph: {
    fontFamily: font.bodyBlack,
    fontSize: text.body.fontSize + 1,
  },
  // Offset down-right behind the main bar, same skew (inherited from the
  // parent Animated.View's own transform) — a cheap but effective "stacked
  // card" depth cue that works identically on iOS and Android. Sharp corners
  // on purpose (no borderRadius): the front bar itself is a sharp-edged
  // parallelogram once skewed, a rounded rectangle behind it broke that line.
  sweepDepthLayer: {
    position: 'absolute',
    left: 6,
    right: -6,
    top: 6,
    bottom: -6,
    opacity: 0.55,
  },
  // Remaining time, drawn inside the bar below the text — empties
  // left-to-right, holding the bar freezes it (same idea the old toast had).
  // A flat translucent fg-tint (the old approach) barely showed up against a
  // busy gradient — a fixed dark track reads consistently regardless of the
  // kind's own color, with the solid fg fill contrasting against it either way.
  sweepTrack: {
    // Same bug as barStyle/sweepTextRow above: turnBannerBar's
    // alignItems:'center' shrink-wraps any child with no definite width, so
    // without alignSelf:'stretch' this collapsed to zero width (no content
    // of its own) — which is exactly why the timer was invisible, not a
    // color/contrast problem.
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    marginHorizontal: 14,
    backgroundColor: 'rgba(16,18,28,0.2)',
  },
  sweepFill: { height: 4, borderRadius: 2 },

  turnBannerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 235,
    // The reference file itself only insets 4px, but once actually full
    // width on a real screen that read as too tight — 16px (the app's own
    // standard side padding) keeps it wide without touching the edges.
    paddingHorizontal: space.md,
  },
  turnBannerBar: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    ...shadow.raised,
  },
  turnBannerText: {
    fontFamily: font.bodyBlack,
    fontSize: 18,
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  turnBannerChip: {
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16,18,28,0.55)',
  },
  turnBannerChipText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: '#FFFFFF', letterSpacing: 0.5 },

  drawRevealWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 230,
  },
  drawRevealCard: {
    width: 172,
    height: 228,
    borderRadius: radius.lg,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    ...shadow.raised,
  },
  drawRevealTag: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16,18,28,0.55)',
    color: '#FFFFFF',
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    letterSpacing: 0.5,
    zIndex: 1,
    overflow: 'hidden',
  },
  drawRevealImg: { width: '100%', height: '68%' },
  drawRevealEmoji: { fontSize: 58, marginTop: 66 },
  drawRevealName: {
    marginTop: 8,
    fontFamily: font.headingSm,
    fontSize: text.body.fontSize,
    color: colors.ink,
    paddingHorizontal: 8,
  },

  // Shared by the chat panel and the help tooltip: both drop out of their own
  // button on the halfway line, centred, above the board.
  tooltipWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  // Invisible catch-all behind them: tap anywhere to dismiss.
  tooltipScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 },
  chatPanel: {
    width: 264,
    padding: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    ...shadow.raised,
  },
  chatMsg: {
    width: '47%',
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.sunken,
  },
  chatMsgText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: colors.ink, textAlign: 'center' },

  // Vertically centred on its own board row (top/bottom 0 + centre), pinned
  // to the edge it slides in from, above the cards it overlaps.
  chatBubbleWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    maxWidth: '74%',
    justifyContent: 'center',
    zIndex: 60,
  },
  chatBubbleMine: { right: 0, alignItems: 'flex-end' },
  chatBubbleTheirs: { left: 0, alignItems: 'flex-start' },
  // Side colours, matching the arena halves: yours blue with the tail on the
  // right (it slides in from your side), the opponent's red with the tail on
  // the left. Was pink vs. plain white, which read as unrelated to anything.
  chatToast: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
    backgroundColor: colors.primary,
    ...shadow.card,
  },
  chatToastReply: {
    backgroundColor: colors.danger,
    borderBottomRightRadius: radius.lg,
    borderBottomLeftRadius: 4,
  },
  chatToastText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, color: '#FFFFFF' },

  inspectScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,22,34,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70,
    padding: space.xl,
  },
  inspectPanel: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.raised,
  },
  inspectHero: { height: 130, position: 'relative' },
  inspectClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  inspectBody: { padding: 16, gap: 12 },
  inspectName: { fontFamily: font.display, fontSize: 20, color: colors.ink },
  inspectPillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  inspectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  inspectPillText: { fontFamily: font.bodyBold, fontSize: text.bodySmall.fontSize, letterSpacing: 0.4 },
  inspectStatRow: { flexDirection: 'row', gap: 6 },
  inspectStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: colors.sunken,
    borderRadius: 12,
  },
  inspectStatValue: { fontFamily: font.stat, fontSize: 15, color: colors.ink },
  inspectStatLabel: { fontFamily: font.bodyBold, fontSize: 9, lineHeight: 11, color: colors.textFaint, textAlign: 'center' },
  inspectStatHint: { fontFamily: font.body, fontSize: 8, lineHeight: 10, color: colors.textFaint, textAlign: 'center', marginTop: 1 },
  inspectAbilities: {
    backgroundColor: colors.sunken,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  inspectAbilityRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12 },
  inspectAbilityDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  inspectDot: { width: 6, height: 6, marginTop: 6, borderRadius: 3, backgroundColor: colors.accent },
  inspectLine: { flex: 1, fontFamily: font.body, fontSize: text.bodySmall.fontSize, lineHeight: text.bodySmall.lineHeight, color: colors.inkSoft },
  inspectLabel: { fontFamily: font.bodyBold, color: colors.ink },
  inspectNone: { fontFamily: font.body, fontSize: text.body.fontSize, color: colors.textFaint },

  // Local per-card dim (see EnemyVehicleCard) — sits inside the card's own
  // `overflow:'hidden'` border, so it needs no coordinates of its own.
  cardDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,18,28,0.55)',
  },
  // "Just got hit" flash — see useHitPulse. Opacity is animated, base color
  // is opaque; it reads as a quick red pulse rather than a solid overlay.
  cardFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.danger,
  },

  hand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingBottom: 10,
    // Explicit, because a card dragged up out of the hand has to pass OVER
    // the board: sibling order alone stopped being enough once board rows
    // and arriving cards started carrying zIndexes of their own, and the
    // dragged card ended up sliding underneath the card it was aimed at.
    zIndex: 100,
  },
  // The whole strip (grabber + label) is one tap target that folds the drawer.
  handGrabberArea: { alignItems: 'center', paddingVertical: 2 },
  // White-ish rather than the theme's grey: the drawer now sits on the
  // arena's blue half, where a light grey grabber all but disappears.
  handGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  handLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  handLabel: {
    fontFamily: font.bodyBold,
    fontSize: text.bodySmall.fontSize,
    color: 'rgba(255,255,255,0.78)',
  },
  handRowClip: { overflow: 'hidden' },
  // Released once the drawer is fully open, so a card dragged up towards the
  // board isn't sliced off at the drawer's top edge.
  handRowOpen: { overflow: 'visible' },
  handRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    minHeight: HC_H + 6,
    paddingHorizontal: 8,
  },
  // Kartın kendisi değil, onu taşıyan kap: dönüş/ölçek/zIndex burada, yeşil
  // halka da burada — halka kartın DIŞINA taşıyor, kart ise overflow:hidden
  // olduğu için kendi içinde onu kırpardı.
  handCardWrap: {
    width: HC_W,
    height: HC_H,
    position: 'relative',
  },
  handCard: {
    width: HC_W,
    height: HC_H,
    borderWidth: 3,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  handPlayHint: {
    position: 'absolute',
    top: -18,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: font.bodyBlack,
    fontSize: text.bodySmall.fontSize,
    color: colors.primary,
    zIndex: 5,
  },
  hcCost: { position: 'absolute', bottom: 5, left: 5 },

  // Pit Ekibi (support) cards — same footprint as a vehicle HandCard
  // (styles.handCard) but a totally different face: no art, no cost/power
  // pills. Full effect text lives in the long-press panel (see
  // SupportInspectPanel), not crammed onto this small a face.
  supportHandCard: {
    backgroundColor: colors.grapeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  supportEmoji: { fontSize: 34 },
  // Dark text on the light grapeSoft background — the vehicle card's name bar
  // is ink-or-white on the rarity colour, which is wrong here.
  supportName: {
    fontFamily: font.headingSm,
    fontSize: 12,
    color: colors.grapeInk,
    textAlign: 'center',
  },
  supportBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.grape,
  },
  supportBadgeText: { fontFamily: font.stat, fontSize: 7, color: '#FFFFFF' },
  supportInspectHero: { backgroundColor: colors.grapeSoft, alignItems: 'center', justifyContent: 'center' },
  supportInspectEmoji: { fontSize: 44 },
});
