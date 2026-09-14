import type { ImageSourcePropType } from 'react-native';

import { getCard } from '@/data/cards';
import type { VehicleClass } from '@/types';

/**
 * Placeholder car art (from the Claude Design bundle). Only 13 images for 35
 * cards, grouped into three visual pools so at least the broad silhouette
 * matches the vehicle's class — a buggy card no longer shows a city sports
 * car. Within its pool a card is still assigned deterministically by id hash
 * (same card always shows the same picture, spread stays "mixed"). Real
 * per-vehicle art is a later effort.
 */
const CAR_POOL: ImageSourcePropType[] = [
  require('../../assets/cars/c2.png'),
  require('../../assets/cars/c3.png'),
  require('../../assets/cars/c4.png'),
  require('../../assets/cars/c5.png'),
  require('../../assets/cars/c6.png'),
  require('../../assets/cars/c10.png'),
];

const OFFROAD_POOL: ImageSourcePropType[] = [
  require('../../assets/cars/c1.png'),
  require('../../assets/cars/c9.png'),
  require('../../assets/cars/bot1.png'),
  require('../../assets/cars/bot3.png'),
];

const TRUCK_POOL: ImageSourcePropType[] = [
  require('../../assets/cars/c7.png'),
  require('../../assets/cars/c8.png'),
  require('../../assets/cars/bot2.png'),
];

// sports/classic/future are all road cars — no dedicated vintage or
// futuristic art exists among the 13, so they share the car pool rather than
// risk a truck. monster/construction share the heavy-truck pool likewise.
const POOL_BY_CLASS: Record<VehicleClass, ImageSourcePropType[]> = {
  sports: CAR_POOL,
  classic: CAR_POOL,
  future: CAR_POOL,
  offroad: OFFROAD_POOL,
  monster: OFFROAD_POOL,
  utility: TRUCK_POOL,
  construction: TRUCK_POOL,
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function carImage(cardId: string): ImageSourcePropType {
  const pool = POOL_BY_CLASS[getCard(cardId).class] ?? CAR_POOL;
  return pool[hash(cardId) % pool.length];
}
