// @vitest-environment node
// docs/rendering/contents-and-motion.md §4, docs/rendering/cells.md §2.1: the clip tracks become bumps at the mote and the prey, a pulse and an alpha.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ENGULF_CLIP_SEAL_AT,
  MOTION_CLIP,
  MOTION_CLIPS,
  engulfSealProgress,
  type MotionClipId,
} from '@evolution/shared';
import { REST_DEFORMATION } from './cell-deformation';
import {
  EATING_CLIP_CONTEXT,
  REST_CLIP_INPUT,
  UNAIMED_CLIP_CONTEXT,
  clipDeformation,
  clipDeformationPeak,
  engulfClipPosition,
  engulfDeformationPeak,
  sampleClipTracks,
  type ClipPeakContext,
} from './cell-clips';
import { bumpPeak } from './shape-terms';
import { degreesToRadians } from '../geometry';
import { ENGULF_ARM_OFFSET_DEG, ENGULF_ARM_SIGMA_DEG, ENGULF_NOTCH_SIGMA_DEG } from '../constants';

describe('sampleClipTracks', () => {
  it('samples every track of a clip at a position in its domain', () => {
    expect(sampleClipTracks(MOTION_CLIPS.eat, 160)).toMatchObject({ dimple: -0.12, wrap: 0.14, pulse: 1.09 });
    expect(sampleClipTracks(MOTION_CLIPS.engulf, 0.5)).toEqual({ arm: 0.62, notch: -0.1, seal: 0 });
    expect(sampleClipTracks(MOTION_CLIPS.absorbed, 400)['seal']).toBeCloseTo(0.22, 9);
  });
});

/** Ticket #703: the clip's arm peak and seal onset follow the room's seal, and the default is untouched. */
describe('engulfClipPosition', () => {
  const walkSteps = 1_000;
  const progressWalk = [...Array(walkSteps + 1).keys()].map((step) => step / walkSteps);
  const defaultSeal = engulfSealProgress(DEFAULT_BALANCE.absorption);
  /** `ENGULF_WRAP_SECONDS` 0.4 → 1.0 puts the seal at 2/3 (engulf-pace.test.ts). */
  const patchedSeal = engulfSealProgress({ ...DEFAULT_BALANCE.absorption, ['ENGULF_WRAP_SECONDS']: 1.0 });
  const armAt = (progress: number, seal: number): number =>
    sampleClipTracks(MOTION_CLIPS.engulf, engulfClipPosition(progress, seal))['arm']!;

  it('is exactly the identity at the default seal, so the default membrane is pixel-identical', () => {
    expect(defaultSeal).toBe(ENGULF_CLIP_SEAL_AT);
    for (const progress of [...progressWalk, 0.1 + 0.2, 1 / 3, 0.5 + Number.EPSILON]) {
      expect(engulfClipPosition(progress, defaultSeal)).toBe(progress);
    }
  });

  it('lands the arm peak and the seal onset on a patched seal of 2/3', () => {
    expect(patchedSeal).toBeCloseTo(2 / 3, 12);
    expect(engulfClipPosition(patchedSeal, patchedSeal)).toBe(ENGULF_CLIP_SEAL_AT);
    expect(engulfClipPosition(0, patchedSeal)).toBe(0);
    expect(engulfClipPosition(1, patchedSeal)).toBeCloseTo(MOTION_CLIPS.engulf.duration, 12);
    const peakProgress = progressWalk.reduce((best, progress) =>
      armAt(progress, patchedSeal) > armAt(best, patchedSeal) ? progress : best,
    );
    expect(peakProgress).toBeCloseTo(2 / 3, 2);
    expect(armAt(patchedSeal, patchedSeal)).toBeCloseTo(0.62, 12);
    // The fixed keyframes had the arms retracting by 0.6 already; the remapped clip is still reaching there.
    expect(armAt(0.6, patchedSeal)).toBeLessThan(armAt(patchedSeal, patchedSeal));
    const sealAt = (progress: number): number =>
      sampleClipTracks(MOTION_CLIPS.engulf, engulfClipPosition(progress, patchedSeal))['seal']!;
    expect(sealAt(0.6)).toBe(0);
    expect(sealAt(patchedSeal)).toBe(0);
    expect(sealAt(0.8)).toBeGreaterThan(0);
  });

  it('never runs backwards and holds the clip end when the seal is the payout', () => {
    for (let index = 1; index < progressWalk.length; index += 1) {
      const [earlier, later] = [progressWalk[index - 1]!, progressWalk[index]!];
      expect(engulfClipPosition(later, patchedSeal)).toBeGreaterThan(engulfClipPosition(earlier, patchedSeal));
    }
    expect(engulfClipPosition(1, 1)).toBe(MOTION_CLIPS.engulf.duration);
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
      engulfClipPosition: 0.5,
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

  /** The amoeba's lobes reach for the prey (#192): the angle rides only while an engulf is in progress. */
  it('carries the prey angle while engulfing and nowhere else', () => {
    const engulfing = clipDeformation({ ...REST_CLIP_INPUT, preyAngle: 1.2, engulfClipPosition: 0.3 });
    expect(engulfing.preyAngle).toBe(1.2);
    expect(clipDeformation({ ...REST_CLIP_INPUT, preyAngle: 0.5, absorbedSeal: 0.42 }).preyAngle).toBeUndefined();
    expect(clipDeformation({ ...REST_CLIP_INPUT, moteAngle: 1 }).preyAngle).toBeUndefined();
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

/**
 * The engulf is the one clip driven by progress rather than the clock, and `engulfBumps` reads that progress off
 * the input, not off `tracks` — so its peak needs its own walk (ticket #364's two-cell scenes frame by it).
 */
describe('engulfDeformationPeak', () => {
  /** Twenty times the module's own 240 steps. */
  const fineSamples = 4_800;
  const samplingTolerance = 0.002;

  it('is not beaten by a walk twenty times finer over the progress domain', () => {
    const coarse = engulfDeformationPeak();
    let fine = 0;
    for (let step = 0; step <= fineSamples; step += 1) {
      const deformation = clipDeformation({ ...REST_CLIP_INPUT, preyAngle: 0, engulfClipPosition: step / fineSamples });
      fine = Math.max(fine, bumpPeak(deformation.bumps));
    }
    expect(fine).toBeLessThanOrEqual(coarse.bumpRadii * (1 + samplingTolerance) + samplingTolerance);
  });

  /**
   * The wrap frame is the widest, and its sum is documented (contents-and-motion.md §4, the §9 pin): the arm at
   * ±30° plus the far arm's tail minus the notch's — 0.62 + 0.62·e^(−60²/(2·16²)) − 0.10·e^(−30²/(2·12²)).
   */
  it('peaks at the wrap frame’s documented arm sum, not at a keyframe read', () => {
    const farArm = degreesToRadians(2 * ENGULF_ARM_OFFSET_DEG);
    const armSigma = degreesToRadians(ENGULF_ARM_SIGMA_DEG);
    const notchSigma = degreesToRadians(ENGULF_NOTCH_SIGMA_DEG);
    const arm = 0.62;
    const notch = 0.1;
    const armAngle = degreesToRadians(ENGULF_ARM_OFFSET_DEG);
    const documented =
      arm +
      arm * Math.exp(-(farArm ** 2) / (2 * armSigma ** 2)) -
      notch * Math.exp(-(armAngle ** 2) / (2 * notchSigma ** 2));
    const peak = engulfDeformationPeak();
    expect(peak.bumpRadii).toBeCloseTo(documented, 3);
    // Nothing in the engulf pulses the membrane; the seal at 1.0 (0.6) is under the wrap's arm sum.
    expect(peak.pulse).toBe(1);
    expect(peak.bumpRadii).toBeGreaterThan(0.6);
  });

  /** Fed through the clock walk, the engulf reads as a round cell: the reason this walk exists. */
  it('is what the clock-domain walk misses', () => {
    const throughTheClockWalk = clipDeformationPeak(MOTION_CLIP.engulf, {
      moteAngle: null,
      preyAngle: 0,
      absorbedSeal: null,
    });
    expect(throughTheClockWalk.bumpRadii).toBe(0);
    expect(engulfDeformationPeak().bumpRadii).toBeGreaterThan(0);
  });
});
