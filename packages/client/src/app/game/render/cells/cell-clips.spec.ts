// docs/RENDERING.md §4, §2.1: the clip tracks become bumps at the mote and the prey, a pulse and an alpha.

import { describe, expect, it } from 'vitest';
import { MOTION_CLIPS } from '@evolution/shared';
import { REST_DEFORMATION } from './cell-deformation';
import { REST_CLIP_INPUT, clipDeformation, sampleClipTracks } from './cell-clips';
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
