// @vitest-environment node
// The amoeba's arms over real 60 fps frames (#768, #771, docs/visual-style/motion-and-legibility.md §5.1): the clip
// tracker's grip drives the shape terms frame by frame, and no lobe may turn in one frame by more than its share of the
// `PSEUDOPOD_GRIP_EASE_MS` ease, at the grab, at an escape, at the seal or when the held prey changes.

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
import { CellClipTracker } from './cell-clip-tracker';

const absorption = DEFAULT_BALANCE.absorption;
/** A 60 fps frame. */
const FRAME_MS = MILLISECONDS_PER_SECOND / 60;
/** How many frames the ease spans at 60 fps. */
const EASE_FRAMES = PSEUDOPOD_GRIP_EASE_MS / FRAME_MS;
const RADIUS = 40;
const PREY_RADIUS = 10;
/** Long enough either side of each turn for the grip to settle. */
const SETTLE_MS = 2 * PSEUDOPOD_GRIP_EASE_MS;
const TIERS = [1, 2, 3] as const;
type Tier = (typeof TIERS)[number];
/** Where a prey at the arm's full grab reach sits from the amoeba's centre. */
const GRAB_DISTANCE = RADIUS * (1 + AMOEBA_ARM_GRAB_REACH_RADII) - PREY_RADIUS * absorption.ENGULF_COVERAGE_FRACTION;
/** Where a prey the body already covers sits: no arm holds it. */
const COVERED_DISTANCE = RADIUS / 2;
const PREY_A_ANGLE = -1.1;
const PREY_B_ANGLE = 0.9;
/**
 * The held lobe sits at `(its fan place)(1 − s) + prey · s` while its fan place turns with the grip share `s` too, so its
 * fastest frame turns up to twice the swing plus its own offset in the fan (under the swing in these scenes) over the
 * ease; a one-frame re-aim turns the whole swing in one frame, `EASE_FRAMES` (18) times the even share.
 */
const UNEVEN_SWING_FACTOR = 3;

/** The amoeba's resolved motion: where it heads and how fast, as a share of top speed. */
interface Swim {
  readonly heading: number;
  readonly speedRatio: number;
}

/** One frame's world: the prey the amoeba engulfs (`null` for none) and every other cell in view. */
interface Frame {
  readonly engulfing: CellView | null;
  readonly others: readonly CellView[];
}

function amoebaOf(tier: Tier): CellView {
  return createTestCellView({
    id: entityId('amoeba'),
    radius: RADIUS,
    stage: CELL_STAGE.specialised,
    traits: [{ traitId: 'amoeba_pseudopods', tier }],
  });
}

function preyAt(id: string, angle: number, distance: number): CellView {
  const [x, y] = [distance * Math.cos(angle), distance * Math.sin(angle)];
  return createTestCellView({ id: entityId(id), x, y, radius: PREY_RADIUS, engulfProgress: 0.1 });
}

/** Each lobe's centre on every frame from 0 to `endMs`, the world at each frame from `script`. */
function lobeCentres(tier: Tier, swim: Swim, endMs: number, script: (nowMs: number) => Frame): number[][] {
  const amoeba = amoebaOf(tier);
  const count = PSEUDOPOD_COUNT_BY_TIER[tier - 1]!;
  const tracker = new CellClipTracker();
  const frames: number[][] = [];
  for (let nowMs = 0; nowMs <= endMs; nowMs += FRAME_MS) {
    const { engulfing, others } = script(nowMs);
    const predator: CellView = { ...amoeba, engulfingCellId: engulfing?.id ?? null };
    const deformation = deformationOf(tracker.deformations([predator, ...others], nowMs, absorption), amoeba.id);
    const terms = buildShapeTerms({
      view: predator,
      traits: summariseCellTraits(predator),
      timeSeconds: nowMs / MILLISECONDS_PER_SECOND,
      ...swim,
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

/** The furthest any lobe turned between two frames, radians. */
function turnBetween(before: readonly number[], after: readonly number[]): number {
  return Math.max(...after.map((centre, lobe) => Math.abs(wrapAngle(centre - before[lobe]!))));
}

const frameAt = (atMs: number): number => Math.round(atMs / FRAME_MS);
/** How far the arms drift a frame on their own (the rest sway), measured over the settled frames before the grab. */
function idleDrift(frames: readonly number[][]): number {
  const settled = frames.slice(0, frameAt(SETTLE_MS));
  return Math.max(...settled.slice(1).map((lobes, frame) => turnBetween(settled[frame]!, lobes)));
}

/** No frame turns any lobe by more than its share of the widest swing the ease makes, plus the idle drift. */
function expectEased(frames: readonly number[][], swing: number, label: string): void {
  const limit = (UNEVEN_SWING_FACTOR * swing) / EASE_FRAMES + idleDrift(frames) + 1e-9;
  frames.slice(1).forEach((lobes, frame) => {
    expect(turnBetween(frames[frame]!, lobes), `${label}, frame ${frame + 1}`).toBeLessThanOrEqual(limit);
  });
}

/** How far the nearest lobe is from `angle`. */
const nearestMiss = (lobes: readonly number[], angle: number): number =>
  Math.min(...lobes.map((centre) => Math.abs(wrapAngle(centre - angle))));

describe('the held arm over real frames (#768)', () => {
  it('swings onto the prey at the grab and back after an escape, an even share a frame, at every tier', () => {
    const prey = preyAt('prey', PREY_A_ANGLE, GRAB_DISTANCE);
    const flatOut = { heading: PREY_A_ANGLE, speedRatio: 1 };
    for (const tier of TIERS) {
      const frames = lobeCentres(tier, flatOut, 3 * SETTLE_MS, (nowMs) => ({
        engulfing: nowMs >= SETTLE_MS && nowMs < 2 * SETTLE_MS ? prey : null,
        others: [prey],
      }));
      const fan = frames[0]!;
      const swing = nearestMiss(fan, PREY_A_ANGLE);
      frames.slice(1).forEach((lobes, frame) => {
        expect(turnBetween(frames[frame]!, lobes), `tier ${tier}, frame ${frame + 1}`).toBeLessThanOrEqual(
          swing / EASE_FRAMES + 1e-9,
        );
      });
      expect(nearestMiss(frames[frameAt(2 * SETTLE_MS) - 1]!, PREY_A_ANGLE), `tier ${tier}`).toBeCloseTo(0, 9);
      expect(frames.at(-1), `tier ${tier}`).toEqual(fan);
    }
  });
});

describe('the whole fan over real frames (#771)', () => {
  /** Slow and heading away from the prey, so at the grab the fan both turns and spreads to the flanks. */
  const slow = { heading: PREY_A_ANGLE + 2, speedRatio: 0.2 };

  /** The widest any lobe moves between the settled free fan and the settled engulfing one. */
  const fanSwing = (frames: readonly number[][]) =>
    turnBetween(frames[frameAt(SETTLE_MS) - 1]!, frames[frameAt(2 * SETTLE_MS) - 1]!);

  it('turns to the prey over the ease at the grab and back after an escape, at every tier', () => {
    const prey = preyAt('prey', PREY_A_ANGLE, GRAB_DISTANCE);
    for (const tier of TIERS) {
      const frames = lobeCentres(tier, slow, 3 * SETTLE_MS, (nowMs) => ({
        engulfing: nowMs >= SETTLE_MS && nowMs < 2 * SETTLE_MS ? prey : null,
        others: [prey],
      }));
      expect(fanSwing(frames), `tier ${tier}`).toBeGreaterThan(1);
      expect(nearestMiss(frames[frameAt(2 * SETTLE_MS) - 1]!, PREY_A_ANGLE), `tier ${tier}`).toBeCloseTo(0, 9);
      expectEased(frames, fanSwing(frames), `tier ${tier}`);
    }
  });

  it('turns back over the ease after the seal, when the body had covered the prey', () => {
    const prey = preyAt('prey', PREY_A_ANGLE, COVERED_DISTANCE);
    for (const tier of TIERS) {
      const frames = lobeCentres(tier, slow, 3 * SETTLE_MS, (nowMs) => {
        const isHeld = nowMs >= SETTLE_MS && nowMs < 2 * SETTLE_MS;
        return { engulfing: isHeld ? prey : null, others: nowMs < 2 * SETTLE_MS ? [prey] : [] };
      });
      expect(fanSwing(frames), `tier ${tier}`).toBeGreaterThan(1);
      expectEased(frames, fanSwing(frames), `tier ${tier}`);
    }
  });
});

describe('a switch of held prey over real frames (#771)', () => {
  const preyA = preyAt('a', PREY_A_ANGLE, GRAB_DISTANCE);
  const preyB = preyAt('b', PREY_B_ANGLE, GRAB_DISTANCE);
  const flatOut = { heading: PREY_A_ANGLE, speedRatio: 1 };
  const swing = Math.abs(wrapAngle(PREY_B_ANGLE - PREY_A_ANGLE));

  /** Holds A, then B from `switchMs` after a gap of `gapMs` with nothing held, then lets go. */
  function switchFrames(tier: Tier, gapMs: number): number[][] {
    const switchMs = 2 * SETTLE_MS;
    return lobeCentres(tier, flatOut, 4 * SETTLE_MS, (nowMs) => {
      const held = nowMs < SETTLE_MS || nowMs >= 3 * SETTLE_MS ? null : nowMs < switchMs ? preyA : preyB;
      const isGap = nowMs >= switchMs && nowMs < switchMs + gapMs;
      return { engulfing: isGap ? null : held, others: [preyA, preyB] };
    });
  }

  it('slides the held arm and the fan from one prey to the next over the ease, at every tier', () => {
    for (const gapMs of [0, FRAME_MS]) {
      for (const tier of TIERS) {
        const frames = switchFrames(tier, gapMs);
        const label = `tier ${tier}, gap ${gapMs} ms`;
        expect(nearestMiss(frames[frameAt(2 * SETTLE_MS) - 1]!, PREY_A_ANGLE), label).toBeCloseTo(0, 9);
        expect(nearestMiss(frames[frameAt(3 * SETTLE_MS) - 1]!, PREY_B_ANGLE), label).toBeCloseTo(0, 9);
        expectEased(frames, swing, label);
      }
    }
  });
});
