// `effectSpriteReachRadii` is a **bound** over a sampled walk, and this file is what makes both words mean
// something: that a far finer walk never finds a sprite outside it, and that the number is the real placements'
// rather than a restatement of the clips' keyframes.

import { MOTION_CLIP, MOTION_CLIPS, type MotionClipId } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { sampleClipTracks } from '../cells/cell-clips';
import { LEVEL_UP_RIPPLE_RADII } from '../constants';
import { effectSpriteReachRadii } from './effect-reach';
import { effectPlacements, type EffectSource } from './effect-sprites';

/** The same unit cell `effect-reach.ts` measures against, so the two walks are comparable. */
const UNIT_SOURCE: EffectSource = { x: 0, y: 0, radius: 1, colour: '#ffffff', target: null };

/** Twenty times the module's own 240 steps: fine enough that a missed peak would show. */
const FINE_SAMPLES = 4_800;

const HALF_OF = 0.5;

function finestReachRadii(clipId: MotionClipId): number {
  const clip = MOTION_CLIPS[clipId];
  let furthest = 0;
  for (let step = 0; step <= FINE_SAMPLES; step += 1) {
    const progress = step / FINE_SAMPLES;
    const tracks = sampleClipTracks(clip, progress * clip.duration);
    for (const placement of effectPlacements(clipId, UNIT_SOURCE, tracks, progress)) {
      const centreDistance = Math.hypot(placement.x, placement.y);
      furthest = Math.max(furthest, centreDistance + Math.hypot(placement.widthWu, placement.heightWu) * HALF_OF);
    }
  }
  return furthest;
}

describe('effectSpriteReachRadii', () => {
  /**
   * The bound's job. The module walks each clip at 240 steps; this walks it at 4 800 and asks whether anything
   * was missed. A tolerance is allowed **upward only** — the fine walk may find a hair more than the coarse one
   * because a peak falls between two of its steps — and it is a fraction of a percent, far under the framing
   * margin `PREVIEW_LENS_FILL_MARGIN` leaves.
   */
  it('is not beaten by a walk twenty times finer', () => {
    for (const clipId of Object.values<MotionClipId>(MOTION_CLIP)) {
      const coarse = effectSpriteReachRadii(clipId);
      const fine = finestReachRadii(clipId);
      expect(coarse, `${clipId}: the coarse walk claimed more than the fine one could find`).toBeLessThanOrEqual(
        fine * (1 + samplingTolerance) + samplingTolerance,
      );
      expect(
        fine,
        `${clipId}: a 20x finer walk found a sprite ${fine.toFixed(4)} out, past the ${coarse.toFixed(4)} bound`,
      ).toBeLessThanOrEqual(coarse * (1 + samplingTolerance) + samplingTolerance);
    }
  });

  const samplingTolerance = 0.005;

  /**
   * The two cases the module's own doc comment separates, run as two cases: a clip that places sprites and one
   * that does not. A bound that returned 0 for everything would pass the walk test above trivially.
   */
  it('reaches past the cell for a clip that places sprites, and nowhere for one that does not', () => {
    expect(effectSpriteReachRadii(MOTION_CLIP.levelUp)).toBeGreaterThan(1);
    expect(effectSpriteReachRadii(MOTION_CLIP.eat)).toBeGreaterThan(1);
    // `sprintRelease` moves the membrane and the rim's brightness; it places no effect sprite at all.
    expect(effectSpriteReachRadii(MOTION_CLIP.sprintRelease)).toBe(0);
  });

  /**
   * That the number really is the **placements'**. The outermost ripple is `LEVEL_UP_RIPPLE_RADII`'s last entry
   * pushed outward by the `rippleRadii` track, so the level-up's reach has to exceed that entry on its own — a
   * bound read off the track peaks instead would land at the track's own 2.5 and miss the push.
   */
  it('includes the push the level-up ripples are moved outward by', () => {
    const outermostAtRest = LEVEL_UP_RIPPLE_RADII[LEVEL_UP_RIPPLE_RADII.length - 1]!;
    expect(effectSpriteReachRadii(MOTION_CLIP.levelUp)).toBeGreaterThan(outermostAtRest);
  });

  /** The widest clip in the game, and so the one that sets the `level_up` scene's lens. */
  it('makes the level-up the widest of them all', () => {
    const others = Object.values<MotionClipId>(MOTION_CLIP)
      .filter((clipId) => clipId !== MOTION_CLIP.levelUp)
      .map(effectSpriteReachRadii);
    expect(effectSpriteReachRadii(MOTION_CLIP.levelUp)).toBeGreaterThan(Math.max(...others));
  });
});
