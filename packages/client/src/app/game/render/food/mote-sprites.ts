// What a mote sprite looks like this frame (docs/VISUAL-STYLE.md §2, §5, §6): the atlas key per
// kind and variant, the small variant below the zoom threshold, the breath (±6 % at a rate and
// phase drawn once from the mote's cosmetic fork), the bacterium's tumble and heading, and the px
// floors of the core and the wide halo. Pure; the food layer applies the result to particles.

import {
  ALGAE_RADIUS,
  BACTERIUM_RADIUS,
  BACTERIUM_VARIANT,
  COSMETIC_SUB_STREAM,
  DETRITUS_RADIUS,
  FOOD_KIND,
  RADIANS_PER_FULL_TURN,
  type EntityId,
  type FoodMoteView,
  type RandomSource,
} from '@evolution/shared';
import {
  ALGAE_GLOW,
  BACTERIUM_BAKE,
  BACTERIUM_TUMBLE_DEG,
  BACTERIUM_TUMBLE_HZ,
  DETRITUS_GLOW,
  MOTE_BREATH_AMPLITUDE,
  MOTE_BREATH_HZ_MAX,
  MOTE_BREATH_HZ_MIN,
  MOTE_CORE_MIN_PX,
  MOTE_SMALL_VARIANT_MAX_ZOOM,
  MOTE_WIDE_HALO_MIN_PX,
} from '../constants';
import { degreesToRadians, lerp } from '../geometry';
import { MOTE_SPRITE, type MoteSpriteKey } from '../textures/mote-atlas';

/** Drawn once per mote from its cosmetic fork (docs/RENDERING.md §1); phases in turns. */
export interface MoteCosmetics {
  readonly breathHz: number;
  readonly breathPhase: number;
  readonly tumblePhase: number;
}

export interface MoteAppearance {
  readonly key: MoteSpriteKey;
  readonly isSmallVariant: boolean;
  /** The body radius to show, world units: the kind's radius with the px floors, breathing. */
  readonly bodyRadiusWu: number;
  /** `bodyRadiusWu` over the kind's radius: what the baked sprite is scaled by beyond its px/wu. */
  readonly bodyScale: number;
  readonly rotation: number;
}

export interface MoteAppearanceInput {
  readonly mote: FoodMoteView;
  readonly cosmetics: MoteCosmetics;
  /** The bacterium's held heading (bacterium-heading.ts); ignored for algae and detritus. */
  readonly heading: number;
  readonly timeSeconds: number;
  readonly zoom: number;
}

const BODY_RADIUS_WU: Readonly<Record<MoteSpriteKey, number>> = {
  [MOTE_SPRITE.algae]: ALGAE_RADIUS,
  [MOTE_SPRITE.detritus]: DETRITUS_RADIUS,
  [MOTE_SPRITE.bacteriumPlain]: BACTERIUM_RADIUS,
  [MOTE_SPRITE.bacteriumAerobic]: BACTERIUM_RADIUS,
  [MOTE_SPRITE.bacteriumPhotosynthetic]: BACTERIUM_RADIUS,
};

/** The wide halo's reach in body radii per sprite (the bakes' glow layers), for the halo floor. */
const HALO_REACH_RADII: Readonly<Record<MoteSpriteKey, number>> = {
  [MOTE_SPRITE.algae]: ALGAE_GLOW.wide,
  [MOTE_SPRITE.detritus]: DETRITUS_GLOW.wide,
  [MOTE_SPRITE.bacteriumPlain]: BACTERIUM_BAKE.haloReach,
  [MOTE_SPRITE.bacteriumAerobic]: BACTERIUM_BAKE.haloReach,
  [MOTE_SPRITE.bacteriumPhotosynthetic]: BACTERIUM_BAKE.haloReach,
};

export function moteSpriteKey(mote: Pick<FoodMoteView, 'kind' | 'bacteriumVariant'>): MoteSpriteKey {
  if (mote.kind === FOOD_KIND.algae) return MOTE_SPRITE.algae;
  if (mote.kind === FOOD_KIND.detritus) return MOTE_SPRITE.detritus;
  if (mote.bacteriumVariant === BACTERIUM_VARIANT.aerobic) return MOTE_SPRITE.bacteriumAerobic;
  if (mote.bacteriumVariant === BACTERIUM_VARIANT.photosynthetic) return MOTE_SPRITE.bacteriumPhotosynthetic;
  return MOTE_SPRITE.bacteriumPlain;
}

/** The mote's cosmetic draws, from `fork(mote + ':' + id)` of the round's cosmetic stream. */
export function drawMoteCosmetics(cosmetic: RandomSource, id: EntityId): MoteCosmetics {
  const fork = cosmetic.fork(`${COSMETIC_SUB_STREAM.mote}:${id}`);
  return {
    breathHz: lerp(MOTE_BREATH_HZ_MIN, MOTE_BREATH_HZ_MAX, fork.nextFloat()),
    breathPhase: fork.nextFloat(),
    tumblePhase: fork.nextFloat(),
  };
}

/** ±6 % at 0.3–0.6 Hz, phase per mote (VISUAL-STYLE §5). */
export function moteBreath(cosmetics: MoteCosmetics, timeSeconds: number): number {
  const turns = cosmetics.breathHz * timeSeconds + cosmetics.breathPhase;
  return 1 + MOTE_BREATH_AMPLITUDE * Math.sin(RADIANS_PER_FULL_TURN * turns);
}

/** The world-unit radius a sprite must show at `zoom` to keep its core and its wide halo at their px floors. */
export function flooredRadiusWu(key: MoteSpriteKey, zoom: number): number {
  const coreFloor = MOTE_CORE_MIN_PX / zoom;
  const haloFloor = MOTE_WIDE_HALO_MIN_PX / (HALO_REACH_RADII[key] * zoom);
  return Math.max(BODY_RADIUS_WU[key], coreFloor, haloFloor);
}

/** A rod tumbles ±15° about its heading as it walks (VISUAL-STYLE §5). */
function bacteriumTumble(cosmetics: MoteCosmetics, timeSeconds: number): number {
  const turns = BACTERIUM_TUMBLE_HZ * timeSeconds + cosmetics.tumblePhase;
  return degreesToRadians(BACTERIUM_TUMBLE_DEG) * Math.sin(RADIANS_PER_FULL_TURN * turns);
}

export function moteAppearance(input: MoteAppearanceInput): MoteAppearance {
  const { mote, cosmetics, timeSeconds, zoom } = input;
  const key = moteSpriteKey(mote);
  const isBacterium = mote.kind === FOOD_KIND.bacterium;
  const bodyRadiusWu = flooredRadiusWu(key, zoom) * moteBreath(cosmetics, timeSeconds);
  return {
    key,
    isSmallVariant: zoom < MOTE_SMALL_VARIANT_MAX_ZOOM,
    bodyRadiusWu,
    bodyScale: bodyRadiusWu / BODY_RADIUS_WU[key],
    rotation: isBacterium ? input.heading + bacteriumTumble(cosmetics, timeSeconds) : 0,
  };
}
