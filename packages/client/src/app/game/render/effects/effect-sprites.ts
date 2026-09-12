// The effect sprites (docs/RENDERING.md §4, §6, sheet 03): each clip's placements as data, so the
// layer only positions glow-atlas sprites. A level-up is `LEVEL_UP_RAYS` rays outside the body, a
// shock ring and three concentric ripples, none of them before the burst keyframe (the anticipate
// frame is the bare squash); a respawn a halo bloom from 2 r; an eat a soft halo at the pulse and
// a ring that fades at settle; an absorption `ABSORBED_STREAMS` DNA streams from the ghost to its
// predator. Pure over the clip tracks; every colour is a palette constant or the subject's rim.

import {
  LEVEL_UP_KEYFRAME_MS,
  MOTION_CLIP,
  MOTION_CLIPS,
  RADIANS_PER_FULL_TURN,
  type MotionClipId,
} from '@evolution/shared';
import type { ClipTrackValues } from '../cells/cell-clips';
import {
  ABSORBED_STREAMS,
  ABSORBED_STREAM_RADII,
  ABSORBED_STREAM_SPREAD_DEG,
  DNA,
  DNA_DEEP,
  EAT_HALO_ALPHA,
  EAT_HALO_FADE_START,
  EAT_HALO_RING_ALPHA,
  EFFECT_HALO_ALPHA,
  EFFECT_RING_ALPHA,
  LEVEL_GOLD,
  LEVEL_UP_RAYS,
  LEVEL_UP_RAY_BASE_RADII,
  LEVEL_UP_RAY_WIDTH_RADII,
  LEVEL_UP_RIPPLE_FALLOFF,
  LEVEL_UP_RIPPLE_RADII,
  WHITE,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF, clamp01, degreesToRadians } from '../geometry';
import { GLOW_SPRITE, type GlowSpriteKey } from '../textures/glow-atlas';

export interface EffectSpritePlacement {
  readonly sprite: GlowSpriteKey;
  readonly x: number;
  readonly y: number;
  /** The sprite's width and height in world units. */
  readonly widthWu: number;
  readonly heightWu: number;
  readonly rotation: number;
  readonly colour: string;
  readonly alpha: number;
}

/** Where an effect plays: the subject's centre, radius and rim colour, plus where DNA streams flow to. */
export interface EffectSource {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly colour: string;
  readonly target: { readonly x: number; readonly y: number } | null;
}

const NO_ROTATION = 0;
/** The ray bake is brightest at its base: rotated so the base points at the cell and the tip outward. */
const RAY_BASE_TO_CELL_TURNS = 0.25;
/** The middle stream carries the bright DNA colour, the flanks the deep one. */
const BRIGHT_STREAM_INDEX = 1;
/** Unit progress of the level-up clip at its burst keyframe: nothing of the burst shows before it. */
const LEVEL_UP_BURST_PROGRESS = LEVEL_UP_KEYFRAME_MS.burst / MOTION_CLIPS.level_up.duration;

function centred(
  source: EffectSource,
  sprite: GlowSpriteKey,
  sizeWu: number,
  paint: { readonly colour: string; readonly alpha: number },
): EffectSpritePlacement {
  return { sprite, x: source.x, y: source.y, widthWu: sizeWu, heightWu: sizeWu, rotation: NO_ROTATION, ...paint };
}

/** The rays sit outside the body: base at `LEVEL_UP_RAY_BASE_RADII`, tip at the `rayRadii` track. */
function rayPlacements(source: EffectSource, rayRadii: number, alpha: number): EffectSpritePlacement[] {
  const placements: EffectSpritePlacement[] = [];
  const baseWu = LEVEL_UP_RAY_BASE_RADII * source.radius;
  const length = Math.max(0, rayRadii - LEVEL_UP_RAY_BASE_RADII) * source.radius;
  const centreWu = baseWu + length * HALF;
  for (let ray = 0; ray < LEVEL_UP_RAYS; ray += 1) {
    const angle = (ray / LEVEL_UP_RAYS) * RADIANS_PER_FULL_TURN;
    placements.push({
      sprite: GLOW_SPRITE.ray,
      x: source.x + Math.cos(angle) * centreWu,
      y: source.y + Math.sin(angle) * centreWu,
      widthWu: LEVEL_UP_RAY_WIDTH_RADII * source.radius,
      heightWu: length,
      rotation: angle + RAY_BASE_TO_CELL_TURNS * RADIANS_PER_FULL_TURN,
      colour: LEVEL_GOLD,
      alpha,
    });
  }
  return placements;
}

/** The burst sprites are absent through the anticipate frame, then fade from the burst keyframe to the end. */
function levelUpFade(progress: number): number {
  if (progress < LEVEL_UP_BURST_PROGRESS) return 0;
  return 1 - (progress - LEVEL_UP_BURST_PROGRESS) / (1 - LEVEL_UP_BURST_PROGRESS);
}

function levelUpPlacements(source: EffectSource, tracks: ClipTrackValues, progress: number): EffectSpritePlacement[] {
  const fade = levelUpFade(progress);
  if (fade <= 0) return [];
  const diameter = source.radius * DIAMETER_PER_RADIUS;
  const shock = (tracks['shockRingRadii'] ?? 0) * diameter;
  // The track pushes every ripple outward from its own radius; the falloff dims the outer ones only.
  const push = (tracks['rippleRadii'] ?? LEVEL_UP_RIPPLE_RADII[0]) - LEVEL_UP_RIPPLE_RADII[0];
  const ripples = LEVEL_UP_RIPPLE_RADII.map((radii, ripple) =>
    centred(source, GLOW_SPRITE.ring, (radii + push) * diameter, {
      colour: LEVEL_GOLD,
      alpha: EFFECT_RING_ALPHA * fade * LEVEL_UP_RIPPLE_FALLOFF ** ripple,
    }),
  );
  return [
    ...rayPlacements(source, tracks['rayRadii'] ?? 0, fade),
    centred(source, GLOW_SPRITE.ring, shock, { colour: WHITE, alpha: EFFECT_RING_ALPHA * fade }),
    ...ripples,
  ];
}

function haloPlacement(source: EffectSource, radii: number, alpha: number): EffectSpritePlacement[] {
  const size = radii * source.radius * DIAMETER_PER_RADIUS;
  return [centred(source, GLOW_SPRITE.glow, size, { colour: source.colour, alpha })];
}

/** The eat halo (sheet 03 A): a soft glow through the pulse, then a ring at `haloRadii` that fades over the last tween. */
function eatHaloPlacements(source: EffectSource, tracks: ClipTrackValues, progress: number): EffectSpritePlacement[] {
  const radii = tracks['haloRadii'] ?? 1;
  const fadeShare = clamp01((progress - EAT_HALO_FADE_START) / (1 - EAT_HALO_FADE_START));
  const size = radii * source.radius * DIAMETER_PER_RADIUS;
  const ring = centred(source, GLOW_SPRITE.ring, size, {
    colour: source.colour,
    alpha: EAT_HALO_RING_ALPHA * (1 - fadeShare),
  });
  if (fadeShare > 0) return [ring];
  return [...haloPlacement(source, radii, EAT_HALO_ALPHA), ring];
}

function absorbedPlacements(source: EffectSource, tracks: ClipTrackValues): EffectSpritePlacement[] {
  // `ease_out_back` overshoots: a stream never passes its predator, so the progress is clamped.
  const progress = clamp01(tracks['streamProgress'] ?? 0);
  if (progress <= 0 || source.target === null) return [];
  const placements: EffectSpritePlacement[] = [];
  const baseAngle = Math.atan2(source.target.y - source.y, source.target.x - source.x);
  const distance = Math.hypot(source.target.x - source.x, source.target.y - source.y) * progress;
  const size = source.radius * ABSORBED_STREAM_RADII;
  for (let stream = 0; stream < ABSORBED_STREAMS; stream += 1) {
    const spread = degreesToRadians(ABSORBED_STREAM_SPREAD_DEG) * (stream - (ABSORBED_STREAMS - 1) * HALF);
    placements.push({
      sprite: GLOW_SPRITE.glow,
      x: source.x + Math.cos(baseAngle + spread) * distance,
      y: source.y + Math.sin(baseAngle + spread) * distance,
      widthWu: size,
      heightWu: size,
      rotation: NO_ROTATION,
      colour: stream === BRIGHT_STREAM_INDEX ? DNA : DNA_DEEP,
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
      return eatHaloPlacements(source, tracks, progress);
    case MOTION_CLIP.absorbed:
      return absorbedPlacements(source, tracks);
    default:
      return [];
  }
}
