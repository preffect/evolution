import { describe, expect, it } from 'vitest';
import { MOTION_CLIPS, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { PREY_UNDER_FILM_ALPHA, SPRINT_RIM_BRIGHTNESS, SPRINT_STRETCH_SCALE } from '../constants';
import { MotionClipPlayer } from '../effects/motion-clip-player';
import { clipShapeValues, engulfTracksFor } from './cell-clips';

const context = (nowMs: number) => ({ nowMs, absorbedSealByPredator: new Map() });

describe('clipShapeValues', () => {
  it('is at rest with no clips: no eat, no engulf, pulse 1, full alpha', () => {
    const values = clipShapeValues(new MotionClipPlayer(), createTestCellView(), context(0));
    expect(values.shape).toEqual({ eat: null, engulf: null, absorbedSeal: null, pulse: 1, sprintStretch: 1 });
    expect(values).toMatchObject({
      alpha: 1,
      rimBrightness: 1,
      passBAlpha: 1,
      haloRadiiScale: 1,
      quadExtentRadii: 1,
      rimDash: 0,
    });
  });

  it('reads the eat tracks at the pulse frame and the level-up pulse when no eat plays', () => {
    const player = new MotionClipPlayer();
    player.play(MOTION_CLIPS.eat, 0);
    const eating = clipShapeValues(player, createTestCellView(), context(160));
    expect(eating.shape.eat).toMatchObject({ dimple: -0.12, wrap: 0.14, pulse: 1.09 });
    expect(eating.shape.pulse).toBe(1);
    expect(eating.haloRadiiScale).toBeCloseTo(1.5, 9);
    const levelling = new MotionClipPlayer();
    levelling.play(MOTION_CLIPS.level_up, 0);
    expect(clipShapeValues(levelling, createTestCellView(), context(120)).shape.pulse).toBeCloseTo(0.9, 9);
  });

  it('fades a respawning cell in and blooms its halo', () => {
    const player = new MotionClipPlayer();
    player.play(MOTION_CLIPS.respawn, 0);
    const values = clipShapeValues(player, createTestCellView(), context(0));
    expect(values.alpha).toBe(0);
    expect(values.haloRadiiScale).toBe(2);
    expect(clipShapeValues(player, createTestCellView(), context(400)).alpha).toBe(1);
  });

  it('stretches and brightens a sprinting cell, then eases back through sprint_release', () => {
    const sprinting = clipShapeValues(
      new MotionClipPlayer(),
      createTestCellView({ sprintRemainingTicks: 5 }),
      context(0),
    );
    expect(sprinting.shape.sprintStretch).toBe(SPRINT_STRETCH_SCALE);
    expect(sprinting.rimBrightness).toBe(SPRINT_RIM_BRIGHTNESS);
    const player = new MotionClipPlayer();
    player.play(MOTION_CLIPS.sprint_release, 0);
    const releasing = clipShapeValues(player, createTestCellView(), context(100));
    expect(releasing.shape.sprintStretch).toBeLessThan(SPRINT_STRETCH_SCALE);
    expect(releasing.shape.sprintStretch).toBeGreaterThan(1);
  });

  it('films an engulfed prey and gives a predator its arms from the prey progress or the ghost seal', () => {
    const prey = createTestCellView({ engulfedByCellId: entityId('p') });
    expect(clipShapeValues(new MotionClipPlayer(), prey, context(0)).passBAlpha).toBe(PREY_UNDER_FILM_ALPHA);
    expect(engulfTracksFor(0.5)).toEqual({ arm: 0.62, notch: -0.1, seal: 0 });
    expect(engulfTracksFor(null)).toBeNull();
    const predator = createTestCellView({ id: entityId('p') });
    const sealed = clipShapeValues(new MotionClipPlayer(), predator, {
      nowMs: 0,
      absorbedSealByPredator: new Map([[entityId('p'), 0.42]]),
    });
    expect(sealed.shape.absorbedSeal).toBe(0.42);
  });
});
