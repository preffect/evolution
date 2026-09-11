// The effect sprites (docs/RENDERING.md §4, §6, sheet 03): each clip's placements as data, so the
// layer only positions glow-atlas sprites. A level-up is `LEVEL_UP_RAYS` rays, a shock ring and
// three ripples; a respawn a halo bloom; an eat a brief halo pulse; an absorption three DNA
// streams from the ghost to its predator. Pure over the clip tracks.

import { MOTION_CLIP, RADIANS_PER_FULL_TURN, type MotionClipId } from '@evolution/shared';
import {
  ABSORBED_STREAMS,
  ABSORBED_STREAM_SPREAD_DEG,
  DNA,
  DNA_DEEP,
  EAT_HALO_FADE_START,
  EFFECT_HALO_ALPHA,
  EFFECT_RING_ALPHA,
  LEVEL_GOLD,
  LEVEL_UP_RAYS,
  LEVEL_UP_RAY_WIDTH_RADII,
  LEVEL_UP_RIPPLES,
  WHITE,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { GLOW_SPRITE, type GlowSpriteKey } from '../textures/glow-atlas';
import type { ClipTrackValues } from './motion-clip-player';

export interface EffectSpritePlacement {
  readonly sprite: GlowSpriteKey;
  readonly x: number;
  readonly y: number;
  /** The sprite's width in world units. */
  readonly widthWu: number;
  readonly heightWu: number;
  readonly rotation: number;
  readonly colour: string;
  readonly alpha: number;
}

export interface EffectSource {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly colour: string;
  /** For absorbed streams: where the DNA flows to. */
  readonly targetX?: number;
  readonly targetY?: number;
}

const HALF = 0.5;
const DIAMETER_PER_RADIUS = 2;
const RIPPLE_ALPHA_STEP = 0.6;

function rayPlacements(source: EffectSource, rayRadii: number, alpha: number): EffectSpritePlacement[] {
  const placements: EffectSpritePlacement[] = [];
  for (let ray = 0; ray < LEVEL_UP_RAYS; ray += 1) {
    const angle = (ray / LEVEL_UP_RAYS) * RADIANS_PER_FULL_TURN;
    const length = rayRadii * source.radius;
    placements.push({
      sprite: GLOW_SPRITE.ray,
      x: source.x + Math.cos(angle) * length * HALF,
      y: source.y + Math.sin(angle) * length * HALF,
      widthWu: LEVEL_UP_RAY_WIDTH_RADII * source.radius,
      heightWu: length,
      rotation: angle + Math.PI * HALF,
      colour: LEVEL_GOLD,
      alpha,
    });
  }
  return placements;
}

function ringPlacement(source: EffectSource, sizeWu: number, colour: string, alpha: number): EffectSpritePlacement {
  return {
    sprite: GLOW_SPRITE.ring,
    x: source.x,
    y: source.y,
    widthWu: sizeWu,
    heightWu: sizeWu,
    rotation: 0,
    colour,
    alpha,
  };
}

function levelUpPlacements(source: EffectSource, tracks: ClipTrackValues, progress: number): EffectSpritePlacement[] {
  const fade = 1 - progress;
  const shock = (tracks['shockRingRadii'] ?? 0) * source.radius * DIAMETER_PER_RADIUS;
  const rippleRadii = tracks['rippleRadii'] ?? 0;
  const ripples = Array.from({ length: LEVEL_UP_RIPPLES }, (_unused, ripple) => {
    const share = 1 - ripple / LEVEL_UP_RIPPLES;
    const size = rippleRadii * source.radius * DIAMETER_PER_RADIUS * share;
    return ringPlacement(source, size, LEVEL_GOLD, EFFECT_RING_ALPHA * fade * RIPPLE_ALPHA_STEP ** ripple);
  });
  return [
    ...rayPlacements(source, tracks['rayRadii'] ?? 0, fade),
    ringPlacement(source, shock, WHITE, EFFECT_RING_ALPHA * fade),
    ...ripples,
  ];
}

function haloPlacement(source: EffectSource, radii: number, alpha: number): EffectSpritePlacement[] {
  const size = radii * source.radius * DIAMETER_PER_RADIUS;
  return [
    {
      sprite: GLOW_SPRITE.glow,
      x: source.x,
      y: source.y,
      widthWu: size,
      heightWu: size,
      rotation: 0,
      colour: source.colour,
      alpha,
    },
  ];
}

function absorbedPlacements(source: EffectSource, tracks: ClipTrackValues): EffectSpritePlacement[] {
  const progress = tracks['streamProgress'] ?? 0;
  if (progress <= 0 || source.targetX === undefined || source.targetY === undefined) return [];
  const placements: EffectSpritePlacement[] = [];
  const baseAngle = Math.atan2(source.targetY - source.y, source.targetX - source.x);
  for (let stream = 0; stream < ABSORBED_STREAMS; stream += 1) {
    const spread = degreesToRadians(ABSORBED_STREAM_SPREAD_DEG) * (stream - (ABSORBED_STREAMS - 1) * HALF);
    const distance = Math.hypot(source.targetX - source.x, source.targetY - source.y) * progress;
    placements.push({
      sprite: GLOW_SPRITE.glow,
      x: source.x + Math.cos(baseAngle + spread) * distance,
      y: source.y + Math.sin(baseAngle + spread) * distance,
      widthWu: source.radius * HALF,
      heightWu: source.radius * HALF,
      rotation: 0,
      colour: stream === 1 ? DNA : DNA_DEEP,
      alpha: EFFECT_HALO_ALPHA * (1 - progress),
    });
  }
  return placements;
}

/** The placements of one running clip on `source` at `progress` (0..1) with its sampled `tracks`. */
export function effectPlacements(
  clipId: MotionClipId,
  source: EffectSource,
  tracks: ClipTrackValues,
  progress: number,
): EffectSpritePlacement[] {
  switch (clipId) {
    case MOTION_CLIP.levelUp:
      return levelUpPlacements(source, tracks, progress);
    case MOTION_CLIP.respawn:
      return haloPlacement(source, tracks['haloRadii'] ?? 0, EFFECT_HALO_ALPHA * (1 - progress));
    case MOTION_CLIP.eat:
      return haloPlacement(
        source,
        tracks['haloRadii'] ?? 1,
        EFFECT_HALO_ALPHA * HALF * (1 - Math.max(0, (progress - EAT_HALO_FADE_START) / (1 - EAT_HALO_FADE_START))),
      );
    case MOTION_CLIP.absorbed:
      return absorbedPlacements(source, tracks);
    default:
      return [];
  }
}
