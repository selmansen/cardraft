import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { migratingStorage, STORAGE_KEYS } from '@/api/storageKeys';
import { STARTER_CARD_IDS } from '@/data/cards';
import { STARTER_SUPPORT_IDS } from '@/data/supportCards';
import type { Difficulty } from '@/game/difficulty';
import type { CardInstance } from '@/types';

/**
 * Yerel oyun durumu — ÇEVRİMDIŞI YEDEK.
 *
 * Bakiye ve koleksiyonun doğruluk kaynağı artık sunucu (ADR 0006/0008);
 * buradakiler yalnızca bağlantı yokken ne gösterileceğini belirliyor.
 * Kart açma tamamen sunucuda (`sessionStore.unlockCard`) — burada da bir
 * kopyası olsaydı, çevrimdışıyken açılan kart sunucuya hiç ulaşmaz ve iki
 * koleksiyon kalıcı olarak ayrışırdı.
 */
const STARTING_RIMS = 300;
const STARTING_COINS = 0;
// Loadout is now vehicles + Pit Ekibi (support) cards sharing one 8-card
// budget: at least 3 vehicles (so a deck can always actually attack), at
// most 5 support cards (so a deck can't be all-utility either).
const LOADOUT_TOTAL = 8;
const MIN_VEHICLES = 3;
const MAX_SUPPORT = 5;

/**
 * A card is "owned" iff it has an entry in `collection`. The starter cards are
 * seeded here; everything else is added by `unlockCard` once the player pays.
 */
function seedCollection(): Record<string, CardInstance> {
  const out: Record<string, CardInstance> = {};
  for (const id of STARTER_CARD_IDS) {
    out[id] = { cardId: id, count: 1 };
  }
  return out;
}

function seedSupportCollection(): Record<string, CardInstance> {
  const out: Record<string, CardInstance> = {};
  for (const id of STARTER_SUPPORT_IDS) {
    out[id] = { cardId: id, count: 1 };
  }
  return out;
}

const DEFAULT_LOADOUT = [
  'sandstorm-buggy',
  'falconi-turbo',
  'vipera-gt',
  'boulder-baron',
  'nitro-nomad',
];
// 5 vehicles + 3 of these = a full 8-card kadro out of the box — a battle now
// requires exactly LOADOUT_TOTAL cards, so a fresh save has to already meet it.
// Bunlar açık olan güç-1 destek kartlarıyla aynı üçlü olmak zorunda, yoksa
// yeni oyuncunun varsayılan kadrosu sahip olmadığı bir kart içerir.
const DEFAULT_SUPPORT_LOADOUT = [...STARTER_SUPPORT_IDS];

export interface GameState {
  /** Oynayarak kazanılan para birimi (jant). */
  rims: number;
  /** Satın alınan para birimi (coin). */
  coins: number;
  collection: Record<string, CardInstance>;
  /** Açılmış Pit Ekibi kartları — araçlarla aynı sahiplik mantığı. */
  supportCollection: Record<string, CardInstance>;
  /** Vehicle card ids chosen for the next battle. */
  loadout: string[];
  /** Pit Ekibi (support) card ids chosen for the next battle. */
  supportLoadout: string[];
  battlesPlayed: number;
  battlesWon: number;
  difficulty: Difficulty;
  /** Has the player seen the "How to play" screen at least once? */
  howToPlaySeen: boolean;
  /** Master switch for music + all sound effects. */
  soundOn: boolean;
  /** When there's truly no legal move left, end the turn automatically
   *  instead of waiting for a tap on "Turu Bitir". */
  autoEndTurn: boolean;
  /** Whether the persisted state has finished loading from disk. */
  hydrated: boolean;

  setHydrated: (v: boolean) => void;
  setDifficulty: (d: Difficulty) => void;
  markHowToPlaySeen: () => void;
  toggleSound: () => void;
  toggleAutoEndTurn: () => void;
  isOwned: (cardId: string) => boolean;
  isSupportOwned: (cardId: string) => boolean;
  toggleLoadout: (cardId: string) => void;
  toggleSupportLoadout: (cardId: string) => void;
  setLoadout: (ids: string[]) => void;
  /** Sunucudaki koleksiyonu yerel önbelleğe yazar (çevrimdışı görünüm için). */
  cacheCollections: (vehicles: string[], support: string[]) => void;
  recordBattle: (won: boolean, reward: number) => void;
  resetProgress: () => void;
}

export const LOADOUT_MAX = LOADOUT_TOTAL;
export const LOADOUT_MIN = MIN_VEHICLES;
export { LOADOUT_TOTAL, MIN_VEHICLES, MAX_SUPPORT, STARTING_RIMS };

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      rims: STARTING_RIMS,
      coins: STARTING_COINS,
      collection: seedCollection(),
      supportCollection: seedSupportCollection(),
      loadout: DEFAULT_LOADOUT,
      supportLoadout: DEFAULT_SUPPORT_LOADOUT,
      battlesPlayed: 0,
      battlesWon: 0,
      difficulty: 'easy',
      howToPlaySeen: false,
      soundOn: true,
      autoEndTurn: true,
      hydrated: false,

      setHydrated: (v) => set({ hydrated: v }),
      setDifficulty: (d) => set({ difficulty: d }),
      markHowToPlaySeen: () => set({ howToPlaySeen: true }),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      toggleAutoEndTurn: () => set((s) => ({ autoEndTurn: !s.autoEndTurn })),

      isOwned: (cardId) => get().collection[cardId] != null,
      isSupportOwned: (cardId) => get().supportCollection[cardId] != null,

      toggleLoadout: (cardId) => {
        const state = get();
        if (!state.collection[cardId]) return; // can't field a locked card
        if (state.loadout.includes(cardId)) {
          set({ loadout: state.loadout.filter((id) => id !== cardId) });
        } else if (state.loadout.length + state.supportLoadout.length < LOADOUT_TOTAL) {
          set({ loadout: [...state.loadout, cardId] });
        }
      },

      toggleSupportLoadout: (cardId) => {
        const state = get();
        if (!state.supportCollection[cardId]) return; // can't field a locked card
        if (state.supportLoadout.includes(cardId)) {
          set({ supportLoadout: state.supportLoadout.filter((id) => id !== cardId) });
        } else if (
          state.supportLoadout.length < MAX_SUPPORT &&
          state.loadout.length + state.supportLoadout.length < LOADOUT_TOTAL
        ) {
          set({ supportLoadout: [...state.supportLoadout, cardId] });
        }
      },

      setLoadout: (ids) => set({ loadout: ids.slice(0, LOADOUT_TOTAL) }),

      /**
       * Sunucudan gelen koleksiyonun yerel kopyası.
       *
       * Olmasaydı: çevrimiçiyken 10 kart açan oyuncu uçağa bindiğinde sadece
       * 6 başlangıç kartını görürdü — açtıkları "kaybolmuş" gibi görünürdü.
       * Yerel kopya doğruluk kaynağı DEĞİL, sadece bağlantı yokken
       * gösterilecek son bilinen hâl.
       */
      cacheCollections: (vehicles, support) =>
        set({
          collection: Object.fromEntries(vehicles.map((id) => [id, { cardId: id, count: 1 }])),
          supportCollection: Object.fromEntries(
            support.map((id) => [id, { cardId: id, count: 1 }]),
          ),
        }),

      // Maç ödülü her zaman jant — coin sadece satın alınır, oyun içinde
      // hiçbir yerden kazanılmaz (iki para biriminin ayrı durmasının sebebi bu).
      recordBattle: (won, reward) =>
        set((s) => ({
          rims: s.rims + Math.max(0, reward),
          battlesPlayed: s.battlesPlayed + 1,
          battlesWon: s.battlesWon + (won ? 1 : 0),
        })),

      resetProgress: () =>
        set({
          rims: STARTING_RIMS,
          coins: STARTING_COINS,
          collection: seedCollection(),
          supportCollection: seedSupportCollection(),
          loadout: DEFAULT_LOADOUT,
          supportLoadout: DEFAULT_SUPPORT_LOADOUT,
          battlesPlayed: 0,
          battlesWon: 0,
        }),
    }),
    {
      name: STORAGE_KEYS.save,
      version: 3,
      // Eski anahtar altındaki kaydı bulup taşıyan sarmalayıcı.
      storage: createJSONStorage(() => migratingStorage),
      partialize: (s) => ({
        rims: s.rims,
        coins: s.coins,
        collection: s.collection,
        supportCollection: s.supportCollection,
        loadout: s.loadout,
        supportLoadout: s.supportLoadout,
        battlesPlayed: s.battlesPlayed,
        battlesWon: s.battlesWon,
        difficulty: s.difficulty,
        howToPlaySeen: s.howToPlaySeen,
        soundOn: s.soundOn,
        autoEndTurn: s.autoEndTurn,
      }),
      migrate: (persisted, from) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        // v1 seeded ALL cards as owned; v2 only seeds starters. Drop ownership
        // of cards that are now locked so the unlock economy means something.
        if (from < 2 && p.collection) {
          const starters = new Set(STARTER_CARD_IDS);
          const trimmed: Record<string, CardInstance> = {};
          for (const [id, inst] of Object.entries(p.collection)) {
            if (starters.has(id)) trimmed[id] = inst;
          }
          p.collection = trimmed;
          p.loadout = (p.loadout ?? DEFAULT_LOADOUT).filter((id) => starters.has(id));
          if ((p.loadout?.length ?? 0) < MIN_VEHICLES) p.loadout = DEFAULT_LOADOUT;
        }
        // v3: tek para birimi ikiye ayrıldı. Eskiden `coins` oynayarak
        // kazanılıyordu, yani karşılığı jant — coin sıfırdan başlar, yoksa
        // eski kayıtlara bedava satın alınmış para vermiş oluruz.
        if (from < 3) {
          p.rims = p.coins ?? STARTING_RIMS;
          p.coins = STARTING_COINS;
          // Destek kartları eskiden hepsi açıktı; artık üçü açık.
          p.supportCollection = seedSupportCollection();
          const owned = new Set(STARTER_SUPPORT_IDS);
          p.supportLoadout = (p.supportLoadout ?? DEFAULT_SUPPORT_LOADOUT).filter((id) =>
            owned.has(id),
          );
          if (p.supportLoadout.length === 0) p.supportLoadout = DEFAULT_SUPPORT_LOADOUT;
        }
        return p as GameState;
      },
      // Ensure starter cards are always present (e.g. after adding new ones).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        const collection = { ...seedCollection(), ...(p.collection ?? {}) };
        const supportCollection = {
          ...seedSupportCollection(),
          ...(p.supportCollection ?? {}),
        };
        return { ...current, ...p, collection, supportCollection, hydrated: current.hydrated };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
