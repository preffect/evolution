// The drag through the whole step (docs/ecology/absorption.md §6.1 "the drag", #772): the movement kernel moves the
// predator and keeps its velocity on the record, the engulf step reads that velocity and draws the prey after it, and
// the live balance (`debug_set_balance`) sets the share. A predator passing over a prey at full speed finishes the
// engulf with the drag and drops the prey without it; a prey swimming away from a still predator is released on the
// same tick whatever the share, since the drag never answers the prey's own move (decision #139). Run with
// `./validate.sh integration`.

import { describe, expect, it } from 'vitest';
import { EFFECT_KIND, ENGULF_RELEASE_REASON, playerId, secondsToTicks, type GameEffect } from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { setBalanceForDebug } from '../debug/debug-operations.js';
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

function passOverPrey(dragShare?: number): GameEffect[] {
  const pair = createPair(dragShare);
  pair.predator.x = pair.prey.x - START_GAP_WU;
  pair.predator.y = pair.prey.y;
  pair.predator.velocityX = pair.world.balance.growth.CELL_BASE_SPEED;
  return run(pair, secondsToTicks(PASS_SECONDS), ({ predator }) => {
    predator.targetX = predator.x + FAR_EAST_WU;
    predator.targetY = predator.y;
  });
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
