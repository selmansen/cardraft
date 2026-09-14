import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

import { useGameStore } from '@/store/gameStore';

const WAR_LOOP = require('../../assets/sfx/war-loop.mp3');

// Background ambience, not a soundtrack you're meant to notice — sits far
// under the SFX so a "clank" always reads clearly on top of it. Confirmed
// fine even at full device volume, so this is just the "ambient" level, not
// a safety cap.
const WAR_LOOP_VOLUME = 0.14;

/**
 * Battle screen's constant background loop — starts on mount, loops forever
 * at a low volume, stops when the screen unmounts or the sound toggle is off.
 * `useAudioPlayer` already releases the underlying player automatically on
 * unmount (per its own docs), so there's no separate cleanup effect here —
 * having one that also called player.pause() on the way out could race that
 * internal teardown and throw on an already-released native object, which
 * is the leading suspect for "app crashes when I press Bitir".
 */
export function useBattleMusic() {
  const player = useAudioPlayer(WAR_LOOP);
  const soundOn = useGameStore((s) => s.soundOn);

  useEffect(() => {
    try {
      player.loop = true;
      player.volume = WAR_LOOP_VOLUME;
    } catch {
      // player may already be mid-teardown — never let audio housekeeping
      // take the screen down with it.
    }
  }, [player]);

  useEffect(() => {
    try {
      if (soundOn) player.play();
      else player.pause();
    } catch {
      // same as above
    }
  }, [soundOn, player]);
}
