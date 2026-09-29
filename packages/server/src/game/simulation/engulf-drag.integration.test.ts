// The drag through the whole step (docs/ecology/absorption.md §6.1 "the drag", #772): the movement kernel moves the
// predator and keeps its velocity on the record, the engulf step reads that velocity and draws the prey after it, and
// the live balance (`debug_set_balance`) sets the share. A predator passing over a prey at full speed finishes the
// engulf with the drag and drops the prey without it; a prey swimming away from a still predator is released on the
// same tick whatever the share, since the drag never answers the prey's own move (decision #139). The wire reports a
// dragged prey moving as it is moved (#774), so a client extrapolating a late snapshot carries it with its predator,
// while the record keeps the kernel's velocity. Run with `./validate.sh integration`.

import { describe, expect, it } from 'vitest';
import {
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  MAX_EXTRAPOLATION_TICKS,
  TICK_INTERVAL_S,
  playerId,
  secondsToTicks,
  type CellView,
  type GameEffect,
} from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { setBalanceForDebug } from '../debug/debug-operations.js';
import { toCellView } from '../serialize/serialize.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { stepWorld } from './step.js';

/** E16's pair, the smallest a fresh protocell eats: A 30 over B 20, ratio 1.5, 60 ticks to the payout. */
const PREDATOR_MASS = 30;
const PREY_MASS = 20;
/** A starts this far west of B already at full speed, steering far east of itself: a pass straight over B. */
const START_GAP_WU = 40;
const FAR_EAST_WU = 1000;
/** Long enough for the pass to finish or drop; the engulf takes one second at this ratio. */
const PASS_SECONDS = 2;
/** The still-predator escape: A over B 10 wu apart (E11's spacing), B swims straight away from tick 1. */
const ESCAPE_CENTRE_DISTANCE_WU = 10;
const DRAG_LEAF = 'ENGULF_DRAG_SHARE';
/** Where a late snapshot's extrapolation may leave the prey from where the server puts it (wu): the wire's rounding. */
const EXTRAPOLATION_TOLERANCE_WU = 0.1;
/** How far B's reported speed may be from its true speed (wu/s): the wire's rounding of each axis. */
const SPEED_TOLERANCE_WU_PER_SECOND = 0.1;

interface Pair {
  readonly world: WorldState;
  readonly predator: CellRecord;
  readonly prey: CellRecord;
}

function createPair(dragShare?: number): Pair {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  world.gelPatches = [];
  if (dragShare !== undefined) {
    setBalanceForDebug(world, { absorption: { [DRAG_LEAF]: dragShare } });
  }
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  setCellMass(predator, PREDATOR_MASS, world.balance);
  setCellMass(prey, PREY_MASS, world.balance);
  prey.x = BROTH_POINT.x;
  prey.y = BROTH_POINT.y;
  prey.targetX = null;
  prey.targetY = null;
  return { world, predator, prey };
}

/** Steps the whole tick `ticks` times, steering A with `steer` before each, and returns every effect emitted. */
function run(pair: Pair, ticks: number, steer: (pair: Pair) => void): GameEffect[] {
  const context = createTestStepContext(pair.world);
  const effects: GameEffect[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    steer(pair);
    stepWorld(pair.world, context);
    effects.push(...pair.world.effects.splice(0));
  }
  return effects;
}

function startPass(dragShare?: number): Pair {
  const pair = createPair(dragShare);
  pair.predator.x = pair.prey.x - START_GAP_WU;
  pair.predator.y = pair.prey.y;
  pair.predator.velocityX = pair.world.balance.growth.CELL_BASE_SPEED;
  return pair;
}

function steerFarEast({ predator }: Pair): void {
  predator.targetX = predator.x + FAR_EAST_WU;
  predator.targetY = predator.y;
}

function passOverPrey(dragShare?: number): GameEffect[] {
  return run(startPass(dragShare), secondsToTicks(PASS_SECONDS), steerFarEast);
}

/** One tick of the pass as the wire sent B, and where the server put B. */
interface PreyTick {
  readonly view: CellView;
  readonly x: number;
  readonly y: number;
  readonly isHeldBeforeSeal: boolean;
  readonly kernelSpeed: number;
}

/** The pass tick by tick until B is absorbed: B's wire view after each tick, with its true centre. */
function preyTicksOfPass(): PreyTick[] {
  const pair = startPass();
  const ticks: PreyTick[] = [];
  const context = createTestStepContext(pair.world);
  for (let tick = 0; tick < secondsToTicks(PASS_SECONDS) && pair.world.cells.includes(pair.prey); tick += 1) {
    steerFarEast(pair);
    stepWorld(pair.world, context);
    const { prey } = pair;
    ticks.push({
      view: toCellView(prey),
      x: prey.x,
      y: prey.y,
      isHeldBeforeSeal: prey.engulfedByCellId !== null && prey.carriedOffsetX === null,
      kernelSpeed: Math.hypot(prey.velocityX, prey.velocityY),
    });
  }
  return ticks;
}

/** |B's reported speed − the speed it really moved at this tick| (wu/s): its true move is from the previous tick. */
function reportedSpeedMissWuPerSecond(ticks: readonly PreyTick[], index: number): number {
  const now = ticks[index]!;
  const before = ticks[index - 1]!;
  const trueSpeed = Math.hypot(now.x - before.x, now.y - before.y) / TICK_INTERVAL_S;
  return Math.abs(Math.hypot(now.view.velocityX, now.view.velocityY) - trueSpeed);
}

/** How far the client's late-snapshot extrapolation (`extrapolateCell`) leaves B from where the server put it (wu). */
function extrapolationMissWu(ticks: readonly PreyTick[], index: number): number {
  const from = ticks[index]!;
  const truth = ticks[index + MAX_EXTRAPOLATION_TICKS]!;
  const seconds = MAX_EXTRAPOLATION_TICKS * TICK_INTERVAL_S;
  return Math.hypot(
    from.view.x + from.view.velocityX * seconds - truth.x,
    from.view.y + from.view.velocityY * seconds - truth.y,
  );
}

/** The tick B is released `escaped`, swimming east away from a still A that sits on it. */
function escapeTickFromStillPredator(dragShare: number): number | undefined {
  const pair = createPair(dragShare);
  pair.predator.x = pair.prey.x - ESCAPE_CENTRE_DISTANCE_WU;
  pair.predator.y = pair.prey.y;
  pair.predator.targetX = null;
  pair.predator.targetY = null;
  const effects = run(pair, secondsToTicks(PASS_SECONDS), ({ prey }) => {
    prey.targetX = prey.x + FAR_EAST_WU;
    prey.targetY = prey.y;
  });
  return effects.find((effect) => effect.kind === EFFECT_KIND.cellReleased)?.tick;
}

const kindsOf = (effects: readonly GameEffect[]) =>
  effects.flatMap((effect) =>
    effect.kind === EFFECT_KIND.cellAbsorbed
      ? [effect.kind]
      : effect.kind === EFFECT_KIND.cellReleased
        ? [effect.reason]
        : [],
  );

describe('the drag through the whole step (#772)', () => {
  it('a pass at full speed over a still prey finishes the engulf', () => {
    expect(kindsOf(passOverPrey())).toEqual([EFFECT_KIND.cellAbsorbed]);
  });

  it('the same pass with the drag patched to 0 drops the prey when the predator coasts off it', () => {
    expect(kindsOf(passOverPrey(0))).toEqual([ENGULF_RELEASE_REASON.escaped]);
  });

  it('a prey swimming away from a still predator is released on the same tick with or without the drag', () => {
    const withoutDrag = escapeTickFromStillPredator(0);
    expect(withoutDrag).toBeDefined();
    expect(escapeTickFromStillPredator(1)).toBe(withoutDrag);
  });
});

describe('a dragged prey on the wire (#774)', () => {
  const ticks = preyTicksOfPass();
  // The held ticks before the seal on which B moved east (the drag), with the extrapolation window still in the pass.
  const draggedIndices = ticks.flatMap((tick, index) => {
    const isDragged = tick.isHeldBeforeSeal && index > 0 && tick.x > ticks[index - 1]!.x;
    return isDragged && index + MAX_EXTRAPOLATION_TICKS < ticks.length ? [index] : [];
  });

  it('is reported moving as fast as it really moves, while the record keeps the kernel velocity of a still prey', () => {
    expect(draggedIndices.length).toBeGreaterThan(MAX_EXTRAPOLATION_TICKS);
    expect(
      draggedIndices.map((index) => reportedSpeedMissWuPerSecond(ticks, index) < SPEED_TOLERANCE_WU_PER_SECOND),
    ).toEqual(draggedIndices.map(() => true));
    expect(draggedIndices.map((index) => ticks[index]!.kernelSpeed)).toEqual(draggedIndices.map(() => 0));
  });

  it('extrapolates on a late snapshot to where the server puts it, on every dragged tick before the seal', () => {
    expect(draggedIndices.map((index) => extrapolationMissWu(ticks, index) < EXTRAPOLATION_TOLERANCE_WU)).toEqual(
      draggedIndices.map(() => true),
    );
  });
});
