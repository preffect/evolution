// @vitest-environment node
// The amoeba's arms over real 60 fps frames (#768, #771, docs/visual-style/motion-and-legibility.md §5.1): the clip
// tracker's grip and the cell's render state drive the shape terms frame by frame, as the renderer does, and no lobe may
// turn in one frame by more than its share of the `PSEUDOPOD_GRIP_EASE_MS` ease, at the grab, at an escape, at the seal,
// when the held prey changes, or when the heading wobbles across the line behind the prey.

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_ARM_GRAB_REACH_RADII,
  CELL_STAGE,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  createSeededRandom,
  entityId,
  type CellView,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { MAX_SHAPE_BUMPS, PSEUDOPOD_COUNT_BY_TIER, PSEUDOPOD_GRIP_EASE_MS } from '../constants';
import { deformationOf } from '../cells/cell-deformation';
import { CellRenderState, NO_CELL_CONTACTS, type CellFrameContext } from '../cells/cell-render-state';
import { pseudopodHoldingLobe } from '../cells/forms/amoeba-pseudopods';
import { REST_OWN_CELL_RING } from '../cells/self-ring';
import { wrapAngle } from '../geometry';
import { buildNoiseStrip } from '../noise/noise-strip';
import { CellClipTracker } from './cell-clip-tracker';

const absorption = DEFAULT_BALANCE.absorption;
const TEST_SEED = 42;
const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
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
 * ease. Every other lobe turns evenly with the share, so it gets only a sliver over its even share, for the sway and a
 * wobbling heading. A one-frame re-aim turns the whole swing in
 * one frame, `EASE_FRAMES` (18) times the even share, and §5's 150 ms snap twice it.
 */
const HELD_LOBE_SWING_FACTOR = 3;
const FAN_LOBE_SWING_FACTOR = 1.05;
/** The heading's wobble across the line behind the prey: a player steering a little while it drags its prey (#772). */
const WOBBLE_RADIANS = 0.03;
const WOBBLE_PERIOD_MS = 40;

/** The amoeba's motion: where it heads at `nowMs` and how fast, as a share of top speed. */
interface Swim {
  readonly headingAt: (nowMs: number) => number;
  readonly speedRatio: number;
}

/** One frame's world: the prey the amoeba engulfs (`null` for none) and every other cell in view. */
interface Frame {
  readonly engulfing: CellView | null;
  readonly others: readonly CellView[];
}

const steady = (heading: number, speedRatio: number): Swim => ({ headingAt: () => heading, speedRatio });

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

function frameContext(nowMs: number): CellFrameContext {
  return {
    timeSeconds: nowMs / MILLISECONDS_PER_SECOND,
    zoom: 1,
    balance: DEFAULT_BALANCE,
    ownCell: null,
    strip,
    previewTraitId: null,
    ...NO_CELL_CONTACTS,
    ownCellRing: REST_OWN_CELL_RING,
    starvedOutMass: 1,
  };
}

/** Each lobe's centre on every frame from 0 to `endMs`, the world at each frame from `script`. */
function lobeCentres(tier: Tier, swim: Swim, endMs: number, script: (nowMs: number) => Frame): number[][] {
  const amoeba = amoebaOf(tier);
  const count = PSEUDOPOD_COUNT_BY_TIER[tier - 1]!;
  const tracker = new CellClipTracker();
  const cell = new CellRenderState(amoeba.id, createSeededRandom(TEST_SEED));
  const speed = swim.speedRatio * DEFAULT_BALANCE.growth.CELL_BASE_SPEED;
  const frames: number[][] = [];
  for (let nowMs = 0; nowMs <= endMs; nowMs += FRAME_MS) {
    const { engulfing, others } = script(nowMs);
    const heading = swim.headingAt(nowMs);
    const predator: CellView = {
      ...amoeba,
      velocityX: speed * Math.cos(heading),
      velocityY: speed * Math.sin(heading),
      engulfingCellId: engulfing?.id ?? null,
    };
    const deformation = deformationOf(tracker.deformations([predator, ...others], nowMs, absorption), amoeba.id);
    const { terms } = cell.update(predator, frameContext(nowMs), deformation);
    const first = Math.min(deformation.bumps.length, MAX_SHAPE_BUMPS - count);
    frames.push(terms.bumps.slice(first, first + count).map((lobe) => lobe.centre));
  }
  return frames;
}

/** How far each lobe turned between two frames, radians. */
const turnsBetween = (before: readonly number[], after: readonly number[]): number[] =>
  after.map((centre, lobe) => Math.abs(wrapAngle(centre - before[lobe]!)));
const turnBetween = (before: readonly number[], after: readonly number[]): number =>
  Math.max(...turnsBetween(before, after));

const frameAt = (atMs: number): number => Math.round(atMs / FRAME_MS);
/** How far the arms drift a frame on their own (the sway, a wobbling heading), over the settled frames before the grab. */
function idleDrift(frames: readonly number[][]): number {
  const settled = frames.slice(0, frameAt(SETTLE_MS));
  return Math.max(...settled.slice(1).map((lobes, frame) => turnBetween(settled[frame]!, lobes)));
}

/**
 * No frame turns a lobe by more than its share of the widest swing the ease makes, plus the idle drift: the held lobe
 * (`heldLobe`, `null` when no arm holds) by `HELD_LOBE_SWING_FACTOR` shares, every other by `FAN_LOBE_SWING_FACTOR`.
 */
function expectEased(frames: readonly number[][], swing: number, heldLobe: number | null, label: string): void {
  const drift = idleDrift(frames) + 1e-9;
  const limitOf = (lobe: number) =>
    ((lobe === heldLobe ? HELD_LOBE_SWING_FACTOR : FAN_LOBE_SWING_FACTOR) * swing) / EASE_FRAMES + drift;
  frames.slice(1).forEach((lobes, frame) => {
    turnsBetween(frames[frame]!, lobes).forEach((turn, lobe) => {
      expect(turn, `${label}, frame ${frame + 1}, lobe ${lobe}`).toBeLessThanOrEqual(limitOf(lobe));
    });
  });
}

/** How far the nearest lobe is from `angle`. */
const nearestMiss = (lobes: readonly number[], angle: number): number =>
  Math.min(...lobes.map((centre) => Math.abs(wrapAngle(centre - angle))));

/**
 * The furthest any lobe travels over the grab's ease, frame by frame: its path, not the gap between its ends, since a
 * fan turning a half turn to a prey behind it moves some lobes more than a half turn.
 */
function fanSwing(frames: readonly number[][]): number {
  const eased = frames.slice(frameAt(SETTLE_MS) - 1, frameAt(SETTLE_MS) + Math.ceil(EASE_FRAMES) + 1);
  const steps = eased.slice(1).map((lobes, frame) => turnsBetween(eased[frame]!, lobes));
  return Math.max(...eased[0]!.map((_centre, lobe) => steps.reduce((path, turns) => path + turns[lobe]!, 0)));
}

/** Holds `prey` from `SETTLE_MS` to twice that, then lets it go (or, with `isSealed`, the body takes it). */
const holdThenRelease =
  (prey: CellView, isSealed = false) =>
  (nowMs: number): Frame => {
    const isHeld = nowMs >= SETTLE_MS && nowMs < 2 * SETTLE_MS;
    const isGone = isSealed && nowMs >= 2 * SETTLE_MS;
    return { engulfing: isHeld ? prey : null, others: isGone ? [] : [prey] };
  };

const heldLobeOf = (tier: Tier) => pseudopodHoldingLobe(PSEUDOPOD_COUNT_BY_TIER[tier - 1]!);

describe('the held arm over real frames (#768)', () => {
  it('swings onto the prey at the grab and back after an escape, an even share a frame, at every tier', () => {
    const prey = preyAt('prey', PREY_A_ANGLE, GRAB_DISTANCE);
    for (const tier of TIERS) {
      const frames = lobeCentres(tier, steady(PREY_A_ANGLE, 1), 3 * SETTLE_MS, holdThenRelease(prey));
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
  const slow = steady(PREY_A_ANGLE + 2, 0.2);

  it('turns to the prey over the ease at the grab and back after an escape, at every tier', () => {
    const prey = preyAt('prey', PREY_A_ANGLE, GRAB_DISTANCE);
    for (const tier of TIERS) {
      const frames = lobeCentres(tier, slow, 3 * SETTLE_MS, holdThenRelease(prey));
      expect(fanSwing(frames), `tier ${tier}`).toBeGreaterThan(1);
      expect(nearestMiss(frames[frameAt(2 * SETTLE_MS) - 1]!, PREY_A_ANGLE), `tier ${tier}`).toBeCloseTo(0, 9);
      expectEased(frames, fanSwing(frames), heldLobeOf(tier), `tier ${tier}`);
    }
  });

  it('turns back over the ease after the seal, when the body had covered the prey', () => {
    const prey = preyAt('prey', PREY_A_ANGLE, COVERED_DISTANCE);
    for (const tier of TIERS) {
      const frames = lobeCentres(tier, slow, 3 * SETTLE_MS, holdThenRelease(prey, true));
      expect(fanSwing(frames), `tier ${tier}`).toBeGreaterThan(1);
      expectEased(frames, fanSwing(frames), null, `tier ${tier}`);
    }
  });

  it('keeps turning one way while the heading wobbles across the line behind the prey', () => {
    const prey = preyAt('prey', PREY_A_ANGLE, GRAB_DISTANCE);
    const behind = PREY_A_ANGLE + Math.PI;
    const wobbling = {
      headingAt: (nowMs: number) => behind + WOBBLE_RADIANS * Math.sin(nowMs / WOBBLE_PERIOD_MS),
      speedRatio: 0.2,
    };
    for (const tier of TIERS) {
      const frames = lobeCentres(tier, wobbling, 3 * SETTLE_MS, holdThenRelease(prey));
      expect(fanSwing(frames), `tier ${tier}`).toBeGreaterThan(1);
      expectEased(frames, fanSwing(frames), heldLobeOf(tier), `tier ${tier}`);
    }
  });
});

describe('a switch of held prey over real frames (#771)', () => {
  const preyA = preyAt('a', PREY_A_ANGLE, GRAB_DISTANCE);
  const preyB = preyAt('b', PREY_B_ANGLE, GRAB_DISTANCE);
  const swing = Math.abs(wrapAngle(PREY_B_ANGLE - PREY_A_ANGLE));

  /** Holds A, then B from `switchMs` after a gap of `gapMs` with nothing held, then lets go. */
  function switchFrames(tier: Tier, gapMs: number): number[][] {
    const switchMs = 2 * SETTLE_MS;
    return lobeCentres(tier, steady(PREY_A_ANGLE, 1), 4 * SETTLE_MS, (nowMs) => {
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
        expectEased(frames, swing, heldLobeOf(tier), label);
      }
    }
  });
});
