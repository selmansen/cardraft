import { createAudioPlayer } from 'expo-audio';

import { useGameStore } from '@/store/gameStore';

/**
 * One-shot sound effect sources. Loaded lazily per play (see `playSfx`) —
 * reusing a single pooled AudioPlayer per key and seeking it back to 0 for
 * the next play sounded fine most of the time but was flaky under rapid
 * repeats (attack, attack, attack): `seekTo()` is async, and calling
 * `play()` right after it — while the native player still thinks it's
 * "already playing" from the previous call — could silently no-op. A fresh
 * disposable player per play sidesteps that entirely; these clips are a few
 * hundred KB at most, so the overhead is a non-issue for how often this
 * actually fires (human taps, not per-frame).
 */
const SOURCES = {
  clank: require('../../assets/sfx/clank.mp3'), // vehicle-vs-vehicle hit
  impact: require('../../assets/sfx/impactt.mp3'), // garage hit — heavier
  whoosh: require('../../assets/sfx/whoosh.mp3'), // card played to the board
  confirm: require('../../assets/sfx/confirm.mp3'), // end turn
  win: require('../../assets/sfx/game-win.mp3'),
  lose: require('../../assets/sfx/game-over.mp3'),
  pop: require('../../assets/sfx/pop-tick.mp3'), // picking a card up to drag
} as const;

export type SfxKey = keyof typeof SOURCES;

export interface SfxHandle {
  /** Stops this specific play early and releases it — for the rare sound
   *  (win/lose) that's long enough to still be going when something else
   *  (like "Tekrar Oyna") needs to cut it off. */
  stop: () => void;
}

const NOOP_HANDLE: SfxHandle = { stop: () => {} };

/**
 * Fire-and-forget sound effect. Safe to call in rapid, overlapping succession
 * — every call gets its own player, so a second attack landing before the
 * first "clank" finishes plays cleanly on top of it instead of stealing or
 * garbling the first. Respects the sound on/off toggle, and never throws: a
 * missing/broken sound file should never take the game down with it.
 *
 * Returns a handle to stop THIS play early — most callers can ignore it
 * (the player cleans itself up when playback ends anyway), but a long clip
 * tied to something dismissible (the win/lose modal) should hold onto it.
 */
export function playSfx(key: SfxKey, volume = 1): SfxHandle {
  if (!useGameStore.getState().soundOn) return NOOP_HANDLE;
  try {
    const player = createAudioPlayer(SOURCES[key]);
    player.volume = volume;
    player.play();
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      clearTimeout(backstop);
      sub.remove();
      try {
        player.remove();
      } catch {
        // already removed
      }
    };
    // Release the player once it's done — otherwise every play() leaks an
    // instance. didJustFinish covers the normal case; the timeout is just a
    // backstop in case that event is ever missed (e.g. load failure).
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) cleanup();
    });
    const backstop = setTimeout(cleanup, 8000);
    return {
      stop: () => {
        try {
          player.pause();
        } catch {
          // already gone
        }
        cleanup();
      },
    };
  } catch {
    return NOOP_HANDLE;
  }
}
