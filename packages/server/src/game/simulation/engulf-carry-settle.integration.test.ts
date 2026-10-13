// A prey sealed at the rim is swallowed inside the membrane, through the whole step (docs/ecology/absorption.md §6.1,
// #819 review): the kept grab seals a prey that swims away without sprinting while it still touches the predator, the
// seal records its offset there, and the movement step then draws the carried prey inside the start's bound before the
// payout. Without the settle a prey sealed at the rim is drawn outside the predator for the whole absorb phase (the
// gameplay-qa screenshot on PR #833). Run with `./validate.sh integration`.

import { describe, expect, it } from 'vitest';
import { EFFECT_KIND, type GameEffect } from '@evolution/shared';
import { E9_PAYOUT_TICK, createEngulfFixture, type EngulfFixture } from '../../testing/engulf-builders.js';
import { isCarried } from './engulf-state.js';
import { stepWorld } from './step.js';

/** E11's late turn: the prey steers straight away from this tick on, too late to escape, and is sealed (#819). */
const TURN_AWAY_TICK = 8;
/** Far east of anything, so the prey swims straight away from the predator (wu). */
const FAR_EAST_WU = 1000;
/** The farthest seal settles in 10 ticks (engulf-carry-settle.test.ts). */
const FARTHEST_SETTLE_TICKS = 10;
/** Past E9's payout, for the slower engulf of a prey that struggles. */
const WATCHED_TICKS = E9_PAYOUT_TICK * 2;
const DISTANCE_TOLERANCE_WU = 1e-9;

interface CarriedTick {
  readonly tick: number;
  readonly distance: number;
}

interface SwallowRun {
  readonly carried: readonly CarriedTick[];
  readonly settledDistance: number;
  readonly effects: readonly GameEffect[];
}

/** The E9 pair through `stepWorld`, the prey turning away on `TURN_AWAY_TICK`; every carried tick's centre distance. */
function swallowRun(fixture: EngulfFixture = createEngulfFixture()): SwallowRun {
  const { world, context, predator, prey } = fixture;
  const settledDistance = predator.radius - prey.radius * world.balance.absorption.ENGULF_COVERAGE_FRACTION;
  const carried: CarriedTick[] = [];
  const effects: GameEffect[] = [];
  for (let tick = 1; tick <= WATCHED_TICKS; tick += 1) {
    if (tick === TURN_AWAY_TICK) {
      prey.targetX = prey.x + FAR_EAST_WU;
    }
    stepWorld(world, context);
    effects.push(...world.effects.splice(0));
    if (isCarried(prey)) {
      carried.push({ tick, distance: Math.hypot(prey.x - predator.x, prey.y - predator.y) });
    }
  }
  return { carried, settledDistance, effects };
}

describe('a prey sealed past the start bound is carried inside it (#819 review)', () => {
  it('is sealed past the half-covered bound: the case the settle exists for', () => {
    const { carried, settledDistance } = swallowRun();
    expect(carried[0]?.distance).toBeGreaterThan(settledDistance);
  });

  it('is inside the start bound within the settle ticks and stays there until it is absorbed', () => {
    const { carried, settledDistance, effects } = swallowRun();
    expect(effects.some((effect) => effect.kind === EFFECT_KIND.cellAbsorbed)).toBe(true);
    const afterSettle = carried.slice(FARTHEST_SETTLE_TICKS);
    expect(afterSettle.length).toBeGreaterThan(0);
    for (const { distance } of afterSettle) {
      expect(distance).toBeLessThanOrEqual(settledDistance + DISTANCE_TOLERANCE_WU);
    }
  });
});
