// docs/ECOLOGY.md §6.1, §6.2 and §6.3 rule by rule, on a two-cell world with the masses the
// design's scenario rows use (A 100 / B 20 is E9, A 30 / B 20 is E16). The step is driven directly
// so each rule is observed alone; the same rules seen through the whole tick are the gameplay rows
// in `testing/scenarios/ecology-engulf.gameplay.test.ts`.

import { describe, expect, it } from 'vitest';
import { CELL_STATE, DEFAULT_BALANCE, EFFECT_KIND, ENGULF_RELEASE_REASON, playerId } from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { abortAllEngulfs, abortEngulfsOf, awayEffortOf, canStartEngulf, runEngulfs } from './engulf.js';
import { hasSpitOutRefractory, recordSpitOutRefractory } from './engulf-state.js';

const absorption = DEFAULT_BALANCE.absorption;
/** E9 / E11: A at 100 covers B at 20 with their centres 10 wu apart. */
const PREDATOR_MASS = 100;
const PREY_MASS = 20;
const CENTRE_DISTANCE = 10;
const E9_PAYOUT_TICK = 36;
const E9_COVER_TICKS = 6;
const E9_SEAL_TICK = 18;
/** Half-way through the wrap band: high enough that one decay tick does not fall out of it. */
const E9_MID_WRAP_TICK = 12;
/** From 12/36, decaying 2/36 a tick, progress reaches 6/36 on the third tick and falls under it on the fourth. */
const E9_ESCAPE_TICKS_FROM_MID_WRAP = 4;
/** Far beyond any contact bound and still inside the dish. */
const OUT_OF_CONTACT_WU = 1000;
const PROGRESS_TOLERANCE = 10;

interface Fixture {
  world: WorldState;
  context: StepContext;
  predator: CellRecord;
  prey: CellRecord;
}

function twoCells(predatorMass = PREDATOR_MASS, preyMass = PREY_MASS, centreDistance = CENTRE_DISTANCE): Fixture {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  for (const [cell, mass, offset] of [
    [predator, predatorMass, 0],
    [prey, preyMass, centreDistance],
  ] as const) {
    cell.x = BROTH_POINT.x + offset;
    cell.y = BROTH_POINT.y;
    cell.targetX = cell.x;
    cell.targetY = cell.y;
    setCellMass(cell, mass, DEFAULT_BALANCE);
  }
  return { world, context: createTestStepContext(world), predator, prey };
}

/** One engulf step with the tick advanced as `stepWorld` advances it. */
function stepEngulf(fixture: Fixture, ticks = 1): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    fixture.world.tick += 1;
    runEngulfs(fixture.world, fixture.context);
  }
}

const releaseReasons = (fixture: Fixture): unknown[] =>
  fixture.context.effects
    .filter((effect) => effect.kind === EFFECT_KIND.cellReleased)
    .map((effect) => (effect.kind === EFFECT_KIND.cellReleased ? effect.reason : null));

describe('starting an engulf (docs/ECOLOGY.md §6.1 step 1)', () => {
  it('claims the prey and advances on the same tick', () => {
    const fixture = twoCells();
    stepEngulf(fixture);
    expect(fixture.predator.engulfingCellId).toBe(fixture.prey.id);
    expect(fixture.prey.engulfedByCellId).toBe(fixture.predator.id);
    expect(fixture.predator.states).toEqual([CELL_STATE.engulfing]);
    expect(fixture.prey.states).toEqual([CELL_STATE.beingEngulfed]);
    expect(fixture.prey.engulfProgress).toBeCloseTo(1 / E9_PAYOUT_TICK, PROGRESS_TOLERANCE);
  });

  it('refuses a pair that is out of contact although the mass allows it', () => {
    const fixture = twoCells(PREDATOR_MASS, PREY_MASS, OUT_OF_CONTACT_WU);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBeNull();
  });

  it('refuses a pair under the mass ratio although they overlap (E10)', () => {
    const fixture = twoCells(24, PREY_MASS);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
  });

  it('refuses a prey inside the spit-out refractory and allows it the tick after (T4)', () => {
    const fixture = twoCells();
    recordSpitOutRefractory(fixture.world, { predator: fixture.predator, prey: fixture.prey }, DEFAULT_BALANCE);
    const untilTick = fixture.predator.spitOutRefractories[0]?.untilTick ?? 0;
    fixture.world.tick = untilTick;
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
    fixture.world.tick = untilTick + 1;
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(true);
  });

  it('leaves a prey another predator already claimed alone', () => {
    const fixture = twoCells();
    stepEngulf(fixture);
    const claimedBy = fixture.prey.engulfedByCellId;
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBe(claimedBy);
    expect(fixture.predator.engulfingCellId).toBe(fixture.prey.id);
  });
});

describe('phases and the seal (docs/ECOLOGY.md §6.1)', () => {
  it('E9: cover for six ticks, seal on tick 18, payout on tick 36', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_COVER_TICKS);
    expect(fixture.prey.engulfProgress).toBeCloseTo(absorption.ENGULF_WRAP_START_PROGRESS, PROGRESS_TOLERANCE);
    expect(fixture.prey.carriedOffsetX).toBeNull();
    stepEngulf(fixture, E9_SEAL_TICK - E9_COVER_TICKS);
    expect(fixture.prey.engulfProgress).toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE);
    expect(fixture.prey.carriedOffsetX).toBeCloseTo(CENTRE_DISTANCE, PROGRESS_TOLERANCE);
    expect(fixture.prey.velocityX).toBe(0);
    stepEngulf(fixture, E9_PAYOUT_TICK - E9_SEAL_TICK);
    expect(fixture.predator.engulfingCellId).toBeNull();
    expect(fixture.prey.engulfProgress).toBe(0);
    expect(fixture.prey.states).toEqual([]);
  });

  it('emits no release effect on completion: the payout is the #259 seam', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_PAYOUT_TICK);
    expect(releaseReasons(fixture)).toEqual([]);
  });

  it('records the carried offset the tick the seal closes, not before', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK - 1);
    expect(fixture.prey.carriedOffsetY).toBeNull();
    stepEngulf(fixture);
    expect(fixture.prey.carriedOffsetY).toBeCloseTo(0, PROGRESS_TOLERANCE);
  });
});

describe('escape (docs/ECOLOGY.md §6.1, §6.3 "prey moves away before the seal")', () => {
  it('releases a cover the tick contact breaks, with progress 0', () => {
    const fixture = twoCells();
    stepEngulf(fixture);
    fixture.prey.x = BROTH_POINT.x + OUT_OF_CONTACT_WU;
    stepEngulf(fixture);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.escaped]);
    expect(fixture.prey.engulfProgress).toBe(0);
    expect(fixture.prey.states).toEqual([]);
  });

  it('decays a wrap out of contact at the escape multiplier and releases it below the wrap band', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_MID_WRAP_TICK);
    const wrapped = fixture.prey.engulfProgress;
    fixture.prey.x = BROTH_POINT.x + OUT_OF_CONTACT_WU;
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress).toBeCloseTo(
      wrapped - absorption.ENGULF_ESCAPE_DECAY_MULTIPLIER / E9_PAYOUT_TICK,
      PROGRESS_TOLERANCE,
    );
    expect(releaseReasons(fixture)).toEqual([]);
    stepEngulf(fixture, E9_ESCAPE_TICKS_FROM_MID_WRAP - 1);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.escaped]);
    expect(fixture.prey.engulfProgress).toBe(0);
  });

  it('never releases a sealed prey for distance: contact holds by construction (E11b)', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    fixture.prey.x = BROTH_POINT.x + OUT_OF_CONTACT_WU;
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBe(fixture.predator.id);
  });
});

describe('the struggle (docs/ECOLOGY.md §6.1)', () => {
  it('is zero for an idle prey and full for one steering straight away', () => {
    const fixture = twoCells();
    expect(awayEffortOf(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(0);
    fixture.prey.targetX = fixture.prey.x + fixture.prey.radius * 5;
    expect(awayEffortOf(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBeCloseTo(1, PROGRESS_TOLERANCE);
  });

  it('is zero for a prey steering back into the predator', () => {
    const fixture = twoCells();
    fixture.prey.targetX = fixture.predator.x - fixture.prey.radius * 5;
    expect(awayEffortOf(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(0);
  });

  it('E11: steering away at full throttle halves the wrap rate', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_COVER_TICKS + 1);
    const beforeIdle = fixture.prey.engulfProgress;
    stepEngulf(fixture);
    const idleGain = fixture.prey.engulfProgress - beforeIdle;
    fixture.prey.targetX = fixture.prey.x + fixture.prey.radius * 5;
    const beforeStruggle = fixture.prey.engulfProgress;
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress - beforeStruggle).toBeCloseTo(idleGain / 2, PROGRESS_TOLERANCE);
  });
});

describe('the ratio release (docs/ECOLOGY.md §6.1 hysteresis, E16)', () => {
  it('holds between the release and the required ratio', () => {
    const fixture = twoCells(30, PREY_MASS);
    stepEngulf(fixture);
    setCellMass(fixture.predator, 23, DEFAULT_BALANCE);
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBe(fixture.predator.id);
  });

  it('releases below the release ratio, in the wrap phase (E16)', () => {
    const fixture = twoCells(30, PREY_MASS);
    stepEngulf(fixture, 10);
    setCellMass(fixture.predator, 21.5, DEFAULT_BALANCE);
    stepEngulf(fixture);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.ratio]);
    expect(fixture.prey.engulfProgress).toBe(0);
  });

  it('releases a sealed prey at its carried offset (E16b)', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    const carriedX = fixture.prey.x;
    setCellMass(fixture.predator, PREY_MASS, DEFAULT_BALANCE);
    stepEngulf(fixture);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.ratio]);
    expect(fixture.prey.x).toBe(carriedX);
    expect(fixture.prey.carriedOffsetX).toBeNull();
  });
});

describe('the spit-out refractory (docs/ECOLOGY.md §6.1, §6.3)', () => {
  it('keeps one entry per spat-out prey and prunes it when it expires', () => {
    const fixture = twoCells();
    recordSpitOutRefractory(fixture.world, { predator: fixture.predator, prey: fixture.prey }, DEFAULT_BALANCE);
    expect(fixture.predator.spitOutRefractories).toHaveLength(1);
    recordSpitOutRefractory(fixture.world, { predator: fixture.predator, prey: fixture.prey }, DEFAULT_BALANCE);
    expect(fixture.predator.spitOutRefractories).toHaveLength(1);
    fixture.world.tick = (fixture.predator.spitOutRefractories[0]?.untilTick ?? 0) + 1;
    runEngulfs(fixture.world, fixture.context);
    expect(fixture.predator.spitOutRefractories).toEqual([]);
  });

  it('forgets a prey that has left the world', () => {
    const fixture = twoCells();
    recordSpitOutRefractory(fixture.world, { predator: fixture.predator, prey: fixture.prey }, DEFAULT_BALANCE);
    fixture.world.cells = [fixture.predator];
    runEngulfs(fixture.world, fixture.context);
    expect(hasSpitOutRefractory(fixture.predator, fixture.prey.id, fixture.world.tick)).toBe(false);
  });

  it('draws nothing from the engulf stream while no prey has spines', () => {
    const fixture = twoCells();
    const before = fixture.world.random.engulf.position;
    stepEngulf(fixture, E9_PAYOUT_TICK);
    expect(fixture.context.streams.engulf.getState().position).toBe(before);
  });
});

describe('aborts (docs/ECOLOGY.md §6.3)', () => {
  it('frees both sides when the prey leaves the world', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    abortEngulfsOf(fixture.world, fixture.prey);
    expect(fixture.predator.engulfingCellId).toBeNull();
    expect(fixture.prey.states).toEqual([]);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.aborted]);
  });

  it('frees a carried prey when its predator leaves the world', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    abortEngulfsOf(fixture.world, fixture.predator);
    expect(fixture.prey.engulfedByCellId).toBeNull();
    expect(fixture.prey.carriedOffsetX).toBeNull();
  });

  it('E13: the results phase aborts every engulf with no payout', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    abortAllEngulfs(fixture.world);
    expect(fixture.predator.states).toEqual([]);
    expect(fixture.prey.states).toEqual([]);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.aborted]);
  });
});
