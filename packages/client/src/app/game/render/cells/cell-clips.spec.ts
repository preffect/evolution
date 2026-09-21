// docs/rendering/contents-and-motion.md §4, docs/rendering/cells.md §2.1: the clip tracks become bumps at the mote and the prey, a pulse and an alpha.

import { describe, expect, it } from 'vitest';
import { MOTION_CLIP, MOTION_CLIPS, type MotionClipId } from '@evolution/shared';
import { REST_DEFORMATION } from './cell-deformation';
import {
  EATING_CLIP_CONTEXT,
  REST_CLIP_INPUT,
  UNAIMED_CLIP_CONTEXT,
  clipDeformation,
  clipDeformationPeak,
  sampleClipTracks,
  type ClipPeakContext,
} from './cell-clips';
import { bumpPeak } from './shape-terms';
import { degreesToRadians } from '../geometry';

describe('sampleClipTracks', () => {
  it('samples every track of a clip at a position in its domain', () => {
    expect(sampleClipTracks(MOTION_CLIPS.eat, 160)).toMatchObject({ dimple: -0.12, wrap: 0.14, pulse: 1.09 });
    expect(sampleClipTracks(MOTION_CLIPS.engulf, 0.5)).toEqual({ arm: 0.62, notch: -0.1, seal: 0 });
    expect(sampleClipTracks(MOTION_CLIPS.absorbed, 400)['seal']).toBeCloseTo(0.22, 9);
  });
});

describe('clipDeformation', () => {
  it('rests with no clips', () => {
    expect(clipDeformation(REST_CLIP_INPUT)).toEqual(REST_DEFORMATION);
  });

  it('aims the eat dimple and wrap at the mote and lets the eat pulse through', () => {
    const tracks = sampleClipTracks(MOTION_CLIPS.eat, 160);
    const deformation = clipDeformation({ ...REST_CLIP_INPUT, tracks, moteAngle: 1 });
    expect(deformation.bumps).toEqual([
      { amplitude: -0.12, centre: 1, sigma: degreesToRadians(22) },
      { amplitude: 0.14, centre: 1, sigma: degreesToRadians(30) },
    ]);
    expect(deformation.pulse).toBeCloseTo(1.09, 9);
    expect(deformation.alpha).toBe(1);
  });

  it('builds the engulf wrap frame from the prey progress and drops the eat bumps while engulfing', () => {
    const tracks = sampleClipTracks(MOTION_CLIPS.eat, 160);
    const deformation = clipDeformation({
      tracks,
      moteAngle: 2,
      preyAngle: 0,
      engulfProgress: 0.5,
      absorbedSeal: null,
    });
    expect(deformation.bumps.map((slot) => [slot.amplitude, slot.centre])).toEqual([
      [0.62, degreesToRadians(30)],
      [0.62, degreesToRadians(-30)],
      [-0.1, 0],
      [0, 0],
    ]);
    expect(deformation.bumps[0]!.sigma).toBeCloseTo(degreesToRadians(16), 12);
    expect(deformation.bumps[2]!.sigma).toBeCloseTo(degreesToRadians(12), 12);
    expect(deformation.pulse).toBeCloseTo(1.09, 9);
  });

  it('relaxes the predator seal from the ghost clip after payout', () => {
    const deformation = clipDeformation({ ...REST_CLIP_INPUT, preyAngle: 0.5, absorbedSeal: 0.42 });
    expect(deformation.bumps).toEqual([{ amplitude: 0.42, centre: 0.5, sigma: degreesToRadians(42) }]);
  });

  it('fades a respawning cell in and pulses a level-up', () => {
    const respawning = clipDeformation({ ...REST_CLIP_INPUT, tracks: sampleClipTracks(MOTION_CLIPS.respawn, 0) });
    expect(respawning.alpha).toBe(0);
    expect(respawning.pulse).toBeCloseTo(0.6, 9);
    const bursting = clipDeformation({ ...REST_CLIP_INPUT, tracks: sampleClipTracks(MOTION_CLIPS.level_up, 250) });
    expect(bursting.pulse).toBeCloseTo(1.14, 9);
  });
});

/**
 * `clipDeformationPeak` is a **bound** over a sampled walk (ticket #364): the encyclopedia preview frames its
 * lens by it, so a peak it misses is a membrane the lens crops. These check both halves of that word — that a
 * far finer walk finds nothing outside it, and that it is the real `clipDeformation`'s peak rather than a
 * restatement of the clips' keyframes.
 */
describe('clipDeformationPeak', () => {
  /** Twenty times the module's own 240 steps. */
  const fineSamples = 4_800;
  const samplingTolerance = 0.002;

  function finestPeak(clipId: MotionClipId, context: ClipPeakContext): { pulse: number; bumpRadii: number } {
    const clip = MOTION_CLIPS[clipId];
    let pulse = 1;
    let bumpRadii = 0;
    for (let step = 0; step <= fineSamples; step += 1) {
      const deformation = clipDeformation({
        ...REST_CLIP_INPUT,
        ...context,
        tracks: sampleClipTracks(clip, (step / fineSamples) * clip.duration),
      });
      pulse = Math.max(pulse, deformation.pulse);
      bumpRadii = Math.max(bumpRadii, bumpPeak(deformation.bumps));
    }
    return { pulse, bumpRadii };
  }

  it('is not beaten by a walk twenty times finer', () => {
    for (const clipId of [MOTION_CLIP.eat, MOTION_CLIP.levelUp, MOTION_CLIP.respawn]) {
      const context = clipId === MOTION_CLIP.eat ? EATING_CLIP_CONTEXT : UNAIMED_CLIP_CONTEXT;
      const coarse = clipDeformationPeak(clipId, context);
      const fine = finestPeak(clipId, context);
      expect(fine.pulse, `${clipId}: a finer walk found pulse ${fine.pulse}`).toBeLessThanOrEqual(
        coarse.pulse * (1 + samplingTolerance),
      );
      expect(fine.bumpRadii, `${clipId}: a finer walk found bumps ${fine.bumpRadii}`).toBeLessThanOrEqual(
        coarse.bumpRadii * (1 + samplingTolerance) + samplingTolerance,
      );
    }
  });

  /**
   * The context is not decoration: `clipDeformation` drops the eat bumps entirely when no `moteAngle` is given,
   * so asking for the eat clip's peak unaimed reports a pulse and no bumps at all. Both cases are run, because
   * the doc comment claims the context decides which set of bumps exists.
   */
  it('reports the eat’s bumps only when the clip is aimed at something', () => {
    const aimed = clipDeformationPeak(MOTION_CLIP.eat, EATING_CLIP_CONTEXT);
    const unaimed = clipDeformationPeak(MOTION_CLIP.eat, UNAIMED_CLIP_CONTEXT);
    expect(aimed.bumpRadii).toBeGreaterThan(0);
    expect(unaimed.bumpRadii).toBe(0);
    // The pulse is not directional, so it survives either way.
    expect(unaimed.pulse).toBe(aimed.pulse);
    expect(aimed.pulse).toBeGreaterThan(1);
  });

  /** A clip that moves neither the pulse nor a bump reports the resting peak, not a fabricated one. */
  it('reports rest for a clip that deforms nothing', () => {
    expect(clipDeformationPeak(MOTION_CLIP.sprintReady, UNAIMED_CLIP_CONTEXT)).toEqual({ pulse: 1, bumpRadii: 0 });
  });
});
