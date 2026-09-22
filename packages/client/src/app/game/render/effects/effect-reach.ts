// How far a motion clip's effect sprites are drawn from the cell they play on (ticket #364): the number the
// encyclopedia preview frames its lens by when a scene emits effects, and the one `preview-framing.spec.ts`
// measures the rim band against.
//
// It **walks `effectPlacements` itself** rather than reading the clips' track peaks, because the tracks do not
// reach the screen unchanged: `levelUpPlacements` adds each ripple's own radius to a shared push, the rays start
// at `LEVEL_UP_RAY_BASE_RADII` and the eat halo drops its glow once the fade starts. A peak read off the
// keyframes would be a different number from the one drawn, and would stop agreeing the first time a placement
// rule was retuned. This way `LEVEL_UP_RIPPLE_RADII` or a new sprite moves the lens by itself.

import { MOTION_CLIPS, type MotionClipId } from '@evolution/shared';
import { sampleClipTracks } from '../cells/cell-clips';
import { HALF } from '../geometry';
import { effectPlacements, type EffectSource } from './effect-sprites';

/**
 * A unit cell at the origin, so every reach this file returns is already in radii. `target` is the thing the
 * effect points at; the clips here draw nothing aimed, and `absorbed` — which does — is the engulf scene's.
 */
const UNIT_SOURCE: EffectSource = { x: 0, y: 0, radius: 1, colour: '#ffffff', target: null };

/** Enough steps to catch a peak between keyframes; `effect-reach.spec.ts` pins it against a 20× finer walk. */
const REACH_SAMPLES = 240;

/**
 * The furthest any sprite of `clipId` is drawn from the cell's centre, in cell radii, over the whole clip; 0 for
 * a clip that draws no sprites.
 *
 * A sprite is placed by its centre and sized by its width and height, so its own furthest corner is half its
 * diagonal away — `hypot(w, h) / 2`, not `max(w, h) / 2`. The difference only matters for a sprite that is not
 * square, but taking the smaller of the two would be a bound that the drawing beats, which is the one direction
 * this must not err in.
 */
export function effectSpriteReachRadii(clipId: MotionClipId): number {
  const cached = reachByClip.get(clipId);
  if (cached !== undefined) return cached;
  const clip = MOTION_CLIPS[clipId];
  let reach = NOTHING_DRAWN;
  for (let step = 0; step <= REACH_SAMPLES; step += 1) {
    const progress = step / REACH_SAMPLES;
    const tracks = sampleClipTracks(clip, progress * clip.duration);
    for (const placement of effectPlacements(clipId, UNIT_SOURCE, tracks, progress)) {
      const centreDistance = Math.hypot(placement.x - UNIT_SOURCE.x, placement.y - UNIT_SOURCE.y);
      reach = Math.max(reach, centreDistance + Math.hypot(placement.widthWu, placement.heightWu) * HALF);
    }
  }
  reachByClip.set(clipId, reach);
  return reach;
}

/** A clip whose effects draw no sprite reaches nowhere; the cell's own membrane is then the whole extent. */
const NOTHING_DRAWN = 0;

/**
 * Memoised on the clip id, which is the whole input: `UNIT_SOURCE` is a constant and the walk is deterministic.
 * The preview asks for this once per frame per scene, and the walk is 241 samples of real placement building.
 */
const reachByClip = new Map<MotionClipId, number>();
