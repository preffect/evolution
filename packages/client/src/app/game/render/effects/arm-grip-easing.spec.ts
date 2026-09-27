// @vitest-environment node
// The held arm's grip (#768, docs/visual-style/motion-and-legibility.md §5.1): it swings onto the prey at the grab and
// back to its flank after an escape over `PSEUDOPOD_GRIP_EASE_MS` on the render clock, never in one frame.

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_ARM_GRAB_REACH_RADII,
  CELL_STAGE,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  entityId,
  type CellView,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { MAX_SHAPE_BUMPS, PSEUDOPOD_COUNT_BY_TIER, PSEUDOPOD_GRIP_EASE_MS } from '../constants';
import { deformationOf } from '../cells/cell-deformation';
import { summariseCellTraits } from '../cells/cell-traits';
import { buildShapeTerms } from '../cells/shape-terms';
import { wrapAngle } from '../geometry';
import { ArmGripEasing } from './arm-grip-easing';
import { CellClipTracker } from './cell-clip-tracker';

const absorption = DEFAULT_BALANCE.absorption;
/** A 60 fps frame. */
const FRAME_MS = MILLISECONDS_PER_SECOND / 60;
const PREY_ANGLE = -1.1;
const RADIUS = 40;
const PREY_RADIUS = 10;
/** Long enough either side of each turn for the grip to settle. */
const SETTLE_MS = 2 * PSEUDOPOD_GRIP_EASE_MS;
const TIERS = [1, 2, 3] as const;

describe('ArmGripEasing', () => {
  it('closes linearly from the grab, lets go from where it was, and hands nothing back once open', () => {
    const grip = new ArmGripEasing();
    expect(grip.letGo(0)).toBeNull();
    expect(grip.hold(0.5, 0.3, 100).share).toBe(0);
    expect(grip.hold(0.6, 0.3, 100 + PSEUDOPOD_GRIP_EASE_MS / 4).share).toBeCloseTo(0.25, 12);
    expect(grip.hold(0.6, 0.3, 100 + PSEUDOPOD_GRIP_EASE_MS * 2).share).toBe(1);
    const escaped = 100 + PSEUDOPOD_GRIP_EASE_MS * 3;
    expect(grip.letGo(escaped)).toEqual({ armHoldRadii: 0.3, armGrip: { angle: 0.6, share: 1 } });
    expect(grip.letGo(escaped + PSEUDOPOD_GRIP_EASE_MS / 2)?.armGrip.share).toBeCloseTo(0.5, 12);
    const regrabbed = escaped + PSEUDOPOD_GRIP_EASE_MS / 2;
    expect(grip.hold(0.6, 0.3, regrabbed).share).toBeCloseTo(0.5, 12);
    expect(grip.letGo(regrabbed)?.armGrip.share).toBeCloseTo(0.5, 12);
    expect(grip.letGo(regrabbed + PSEUDOPOD_GRIP_EASE_MS / 2)).toBeNull();
  });

  it('has nothing to let go of once the body covers the prey', () => {
    const grip = new ArmGripEasing();
    grip.hold(0.5, 0, 0);
    expect(grip.letGo(PSEUDOPOD_GRIP_EASE_MS)).toBeNull();
  });
});

/** An amoeba swimming flat out at its prey, so its fan is the same engulfing or not and only the held arm moves. */
function scene(tier: 1 | 2 | 3) {
  const amoeba = createTestCellView({
    id: entityId('amoeba'),
    radius: RADIUS,
    stage: CELL_STAGE.specialised,
    traits: [{ traitId: 'amoeba_pseudopods', tier }],
  });
  const distance = RADIUS * (1 + AMOEBA_ARM_GRAB_REACH_RADII) - PREY_RADIUS * absorption.ENGULF_COVERAGE_FRACTION;
  const prey = createTestCellView({
    id: entityId('prey'),
    x: distance * Math.cos(PREY_ANGLE),
    y: distance * Math.sin(PREY_ANGLE),
    radius: PREY_RADIUS,
    engulfProgress: 0.1,
  });
  return { amoeba, prey, holding: { ...amoeba, engulfingCellId: prey.id } };
}

/** Each lobe's centre over real frames: `SETTLE_MS` free, `SETTLE_MS` holding, then the prey escapes. */
function lobeCentresOverFrames(tier: 1 | 2 | 3): number[][] {
  const { amoeba, prey, holding } = scene(tier);
  const count = PSEUDOPOD_COUNT_BY_TIER[tier - 1]!;
  const tracker = new CellClipTracker();
  const frames: number[][] = [];
  for (let nowMs = 0; nowMs <= 3 * SETTLE_MS; nowMs += FRAME_MS) {
    const predator: CellView = nowMs >= SETTLE_MS && nowMs < 2 * SETTLE_MS ? holding : amoeba;
    const deformation = deformationOf(tracker.deformations([predator, prey], nowMs, absorption), amoeba.id);
    const terms = buildShapeTerms({
      view: predator,
      traits: summariseCellTraits(predator),
      timeSeconds: nowMs / MILLISECONDS_PER_SECOND,
      speedRatio: 1,
      heading: PREY_ANGLE,
      phase: 0,
      stripRow: 0,
      strip: null,
      deformation,
    });
    const first = Math.min(deformation.bumps.length, MAX_SHAPE_BUMPS - count);
    frames.push(terms.bumps.slice(first, first + count).map((lobe) => lobe.centre));
  }
  return frames;
}

describe('the held arm over real frames (#768)', () => {
  /**
   * The swing is the holding lobe's angle from its flank to the prey. At 60 fps the ease spans
   * `PSEUDOPOD_GRIP_EASE_MS / FRAME_MS` frames, so no frame may turn any lobe further than that share of the swing, at
   * the grab or at the escape, and the arm must actually reach the prey and come back.
   */
  it('swings onto the prey at the grab and back after an escape, an even share a frame, at every tier', () => {
    const minFrames = PSEUDOPOD_GRIP_EASE_MS / FRAME_MS;
    for (const tier of TIERS) {
      const frames = lobeCentresOverFrames(tier);
      const fan = frames[0]!;
      const swing = Math.min(...fan.map((centre) => Math.abs(wrapAngle(centre - PREY_ANGLE))));
      let turningFrames = 0;
      frames.slice(1).forEach((lobes, frame) => {
        const turn = Math.max(...lobes.map((centre, lobe) => Math.abs(wrapAngle(centre - frames[frame]![lobe]!))));
        if (turn > 0) turningFrames += 1;
        expect(turn, `tier ${tier}, frame ${frame + 1}`).toBeLessThanOrEqual(swing / minFrames + 1e-9);
      });
      expect(turningFrames, `tier ${tier}`).toBeGreaterThanOrEqual(2 * Math.floor(minFrames));
      const held = frames[Math.floor((2 * SETTLE_MS) / FRAME_MS) - 1]!;
      expect(Math.min(...held.map((centre) => Math.abs(wrapAngle(centre - PREY_ANGLE)))), `tier ${tier}`).toBeCloseTo(
        0,
        9,
      );
      expect(frames.at(-1), `tier ${tier}`).toEqual(fan);
    }
  });
});
