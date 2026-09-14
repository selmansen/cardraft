import type { ImageSourcePropType } from 'react-native';

/**
 * UNUSED as of the arena redesign — kept, with its assets, in case we ever
 * want a photographic backdrop again.
 *
 * The battle screen used to pick one of these at random per match and lay a
 * 95%-opaque cream scrim over it to keep the light-theme UI legible, which
 * meant the photo was barely visible anyway. It's now a drawn arena instead
 * (see ArenaBackdrop in app/battle.tsx): two coloured halves and an oval
 * table, all derived from the live screen size, so nothing letterboxes or
 * crops on a different phone.
 */
const IMAGES: ImageSourcePropType[] = [
  require('../../assets/arena/arena-bg1.jpg'),
  require('../../assets/arena/arena-bg2.jpg'),
  require('../../assets/arena/arena-bg3.jpg'),
  require('../../assets/arena/arena-bg4.jpg'),
];

export function randomArenaImage(): ImageSourcePropType {
  return IMAGES[Math.floor(Math.random() * IMAGES.length)];
}
