// What a mote sprite looks like this frame (docs/VISUAL-STYLE.md §2, §5, §6): the atlas key per
// kind and variant, the small variant below the zoom threshold, the breath (±6 % at a per-mote
// rate and phase from the mote's id), the bacterium's tumble and heading, the mote's px floor.
// Pure; the food layer applies the result to particles.

import {
  ALGAE_RADIUS,
  BACTERIUM_RADIUS,
  DETRITUS_RADIUS,
  FOOD_KIND,
  RADIANS_PER_FULL_TURN,
  hashLabel,
  type FoodMoteView,
} from '@evolution/shared';
import {
  BACTERIUM_TUMBLE_DEG,
  BACTERIUM_TUMBLE_HZ,
  MOTE_BREATH_AMPLITUDE,
  MOTE_BREATH_HZ_MAX,
  MOTE_BREATH_HZ_MIN,
  MOTE_CORE_MIN_PX,
  MOTE_SMALL_VARIANT_MAX_ZOOM,
} from '../constants';
import { degreesToRadians, lerp } from '../geometry';
import { MOTE_SPRITE, type MoteSpriteKey } from '../textures/mote-atlas';

export interface MoteAppearance {
  readonly key: MoteSpriteKey;
  readonly isSmallVariant: boolean;
  /** The body radius to show, world units: the kind's radius with the px floor, breathing. */
  readonly bodyRadiusWu: number;
  /** `bodyRadiusWu` over the kind's radius: what the baked sprite is scaled by beyond its px/wu. */
  readonly bodyScale: number;
  readonly rotation: number;
}

const HASH_UNIT = 0x1_0000;
/** The seed the per-mote phases and rates hash under. */
const MOTE_PHASE_SEED = 0x6d6f7465;

const BODY_RADIUS_WU: Readonly<Record<MoteSpriteKey, number>> = {
  [MOTE_SPRITE.algae]: ALGAE_RADIUS,
  [MOTE_SPRITE.detritus]: DETRITUS_RADIUS,
  [MOTE_SPRITE.bacteriumPlain]: BACTERIUM_RADIUS,
  [MOTE_SPRITE.bacteriumAerobic]: BACTERIUM_RADIUS,
  [MOTE_SPRITE.bacteriumPhotosynthetic]: BACTERIUM_RADIUS,
};

export function moteSpriteKey(mote: Pick<FoodMoteView, 'kind' | 'bacteriumVariant'>): MoteSpriteKey {
  if (mote.kind === FOOD_KIND.algae) return MOTE_SPRITE.algae;
  if (mote.kind === FOOD_KIND.detritus) return MOTE_SPRITE.detritus;
  if (mote.bacteriumVariant === 'aerobic') return MOTE_SPRITE.bacteriumAerobic;
  if (mote.bacteriumVariant === 'photosynthetic') return MOTE_SPRITE.bacteriumPhotosynthetic;
  return MOTE_SPRITE.bacteriumPlain;
}

/** A unit value in [0, 1) hashed from the mote's id, so the same mote breathes the same way every frame. */
export function motePhase(id: string, salt: string): number {
  return (hashLabel(MOTE_PHASE_SEED, `${id}:${salt}`) % HASH_UNIT) / HASH_UNIT;
}

/** ±6 % at 0.3–0.6 Hz, phase per mote (VISUAL-STYLE §5). */
export function moteBreath(id: string, timeSeconds: number): number {
  const rate = lerp(MOTE_BREATH_HZ_MIN, MOTE_BREATH_HZ_MAX, motePhase(id, 'rate'));
  return 1 + MOTE_BREATH_AMPLITUDE * Math.sin(RADIANS_PER_FULL_TURN * (rate * timeSeconds + motePhase(id, 'phase')));
}

/** The world-unit radius a mote must show at `zoom` to keep its core at the px floor. */
export function flooredRadiusWu(bodyRadiusWu: number, zoom: number): number {
  return Math.max(bodyRadiusWu, MOTE_CORE_MIN_PX / zoom);
}

export function moteAppearance(mote: FoodMoteView, heading: number, timeSeconds: number, zoom: number): MoteAppearance {
  const key = moteSpriteKey(mote);
  const isBacterium = mote.kind === FOOD_KIND.bacterium;
  const tumble = isBacterium
    ? degreesToRadians(BACTERIUM_TUMBLE_DEG) *
      Math.sin(RADIANS_PER_FULL_TURN * (BACTERIUM_TUMBLE_HZ * timeSeconds + motePhase(mote.id, 'tumble')))
    : 0;
  const bodyRadiusWu = flooredRadiusWu(BODY_RADIUS_WU[key], zoom) * moteBreath(mote.id, timeSeconds);
  return {
    key,
    isSmallVariant: zoom < MOTE_SMALL_VARIANT_MAX_ZOOM,
    bodyRadiusWu,
    bodyScale: bodyRadiusWu / BODY_RADIUS_WU[key],
    rotation: isBacterium ? heading + tumble : 0,
  };
}
