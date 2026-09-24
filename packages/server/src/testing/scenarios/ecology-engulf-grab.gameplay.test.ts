// docs/ecology/acceptance.md §8, the grab rows (#634): a predator chasing its prey along the dish's rim, where the
// playtest found the engulf impossible to finish. E18 (a close chase completes), E18b (a prey that sprints clear in
// cover still escapes, after the drain) and E18c (a ciliated prey slips the grab and escapes), each run twice and
// hash-compared. The E9-setup rows are `ecology-engulf.gameplay.test.ts` and `ecology-engulf-escape.gameplay.test.ts`.

import { describe, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  ENGULF_RELEASE_REASON,
  PLAYER_LIFE_STATE,
  radiusForMass,
} from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import type { EvolutionScenarioSnapshot } from '../gameplay/evolution-adapter.js';
import { cellOf, distanceBetweenCells } from '../gameplay/evolution-views.js';
import type { EvolutionView } from '../gameplay/evolution-views.js';
import { combineScripts, player, scenarioPlayerId, sprint, type PlayerScript } from '../gameplay/index.js';
import {
  absorption,
  absorptionsOfPredator,
  lifeStateOfPrey,
  preyCell,
  progressOfPrey,
  releaseReasons,
  statesOfPrey,
} from './engulf-setups.js';
import { FULL_THROTTLE_RADII } from './shared-setups.js';

/** E16's pair: ratio 1.5, so the engulf runs at 1/60 a tick and the cover lasts ten ticks when nobody fights. */
const PREDATOR_MASS = 30;
const PREY_MASS = 20;
const PREY_RADIUS_WU = radiusForMass(PREY_MASS, DEFAULT_BALANCE.growth);
/** B against the rim on the +x axis; A 8 wu behind it (−4.8, −6.4), inside the 12.96 wu contact bound. */
const PREY_AT = { x: DEFAULT_BALANCE.world.DISH_RADIUS - PREY_RADIUS_WU, y: 0 };
const PREDATOR_OFFSET_WU = { x: -4.8, y: -6.4 };
const PREDATOR_AT = { x: PREY_AT.x + PREDATOR_OFFSET_WU.x, y: PREY_AT.y + PREDATOR_OFFSET_WU.y };
/** B steers along the rim, leaning this share of its reach into the wall so it slides along the curve. */
const RIM_LEAN = 0.3;
const ROW_TICKS = 150;
/** E18: the plain prey is absorbed on this tick, never released before it. */
const E18_PAYOUT_TICK = 73;
/** E18b: the sprint breaks contact in cover on tick 10; the drain releases B on tick 12. */
const E18B_CONTACT_BREAK_TICK = 10;
const E18B_RELEASE_TICK = 12;
/** E18c: Cilia Fringe III breaks contact in cover on tick 13; the drain releases B on tick 16. */
const E18C_CONTACT_BREAK_TICK = 13;
const E18C_RELEASE_TICK = 16;
const TOP_TIER = 3;

/** The unit tangent of the rim at `point`, counter-clockwise. */
function rimTangentAt(point: { x: number; y: number }): { x: number; y: number } {
  const distance = Math.hypot(point.x, point.y);
  return { x: -point.y / distance, y: point.x / distance };
}

/** B: full throttle counter-clockwise along the rim, leaning into the wall so the clamp keeps it on the curve. */
const alongTheRim: PlayerScript<EvolutionScenarioSnapshot> = (context) => {
  const cell = context.cell;
  if (cell === undefined) return null;
  const tangent = rimTangentAt(cell);
  const reach = FULL_THROTTLE_RADII * cell.radius;
  return {
    targetX: cell.x + (tangent.x + RIM_LEAN * tangent.y) * reach,
    targetY: cell.y + (tangent.y - RIM_LEAN * tangent.x) * reach,
  };
};

/** A: aims ahead of B along the rim, where B is going, as a player's pointer does; never into the wall behind it. */
const leadingThePrey: PlayerScript<EvolutionScenarioSnapshot> = (context) => {
  const cell = context.cell;
  const prey = context.snapshot.cells.find((candidate) => candidate.playerId === scenarioPlayerId(1));
  if (cell === undefined || prey === undefined) return null;
  const tangent = rimTangentAt(prey);
  const reach = FULL_THROTTLE_RADII * cell.radius;
  return { targetX: prey.x + tangent.x * reach, targetY: prey.y + tangent.y * reach };
};

/** "A chases B along the rim" (docs/ecology/acceptance.md §8, E18). */
function rimChase(name: string, preyTraits: readonly { traitId: string; tier: number }[] = []) {
  return scenario(name)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: PREDATOR_MASS, at: PREDATOR_AT })
    .placeCell({ playerIndex: 1, mass: PREY_MASS, at: PREY_AT, traits: preyTraits })
    .from(1, player(0).does(leadingThePrey));
}

/** How far B's centre sits past the contact bound (positive: out of contact). */
function pastContactBound(view: EvolutionView): number | undefined {
  const predator = cellOf(view, 0);
  const prey = cellOf(view, 1);
  const distance = distanceBetweenCells(view, 0, 1);
  if (predator === undefined || prey === undefined || distance === undefined) return undefined;
  return distance - (predator.radius - prey.radius * absorption.ENGULF_COVERAGE_FRACTION);
}

/** Out of contact on `breakTick` yet still held and still in cover, released `escaped` on `releaseTick`, never caught. */
function expectDrainedEscape(builder: ReturnType<typeof rimChase>, breakTick: number, releaseTick: number) {
  return builder
    .advance(ROW_TICKS)
    .expect('in contact the tick before', pastContactBound)
    .atTick(breakTick - 1)
    .toBeLessThan(0)
    .expect(`contact broken on tick ${breakTick}`, pastContactBound)
    .atTick(breakTick)
    .toBeGreaterThan(0)
    .expect('still held on that tick: a slip drains, it does not cancel', statesOfPrey)
    .atTick(breakTick)
    .toEqual([CELL_STATE.beingEngulfed])
    .expect('still in the cover band', progressOfPrey)
    .atTick(breakTick)
    .toBeBetween(0, absorption.ENGULF_WRAP_START_PROGRESS)
    .expect('not yet released the tick before', releaseReasons)
    .atTick(releaseTick - 1)
    .toEqual([])
    .expect(`released on tick ${releaseTick} once drained to 0`, releaseReasons)
    .atTick(releaseTick)
    .toEqual([ENGULF_RELEASE_REASON.escaped])
    .expect('B alive at the end of the row', lifeStateOfPrey)
    .atEnd()
    .toBe(PLAYER_LIFE_STATE.alive)
    .expect('A never catches it again', absorptionsOfPredator)
    .atEnd()
    .toBe(0)
    .runDeterministic();
}

describe('ecology/acceptance.md §8: the grab, chasing along the rim (#634)', () => {
  it('E18: a predator chasing a plain prey along the rim completes the engulf', async () => {
    await rimChase('E18')
      .from(1, player(1).does(alongTheRim))
      .advance(ROW_TICKS)
      .expect('never released', releaseReasons)
      .atTick(E18_PAYOUT_TICK - 1)
      .toEqual([])
      .expect(`B absorbed on tick ${E18_PAYOUT_TICK}`, preyCell)
      .atTick(E18_PAYOUT_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('A absorptions = 1', absorptionsOfPredator)
      .atTick(E18_PAYOUT_TICK)
      .toBe(1)
      .runDeterministic();
  });

  it('E18b: a prey that sprints clear in cover still escapes, released when the drain reaches 0', async () => {
    const sprinting = rimChase('E18b')
      .atTick(1, player(1).does(combineScripts([alongTheRim, sprint()])))
      .from(2, player(1).does(alongTheRim));
    await expectDrainedEscape(sprinting, E18B_CONTACT_BREAK_TICK, E18B_RELEASE_TICK);
  });

  it('E18c: a Cilia Fringe III prey slips the grab and escapes without sprinting', async () => {
    const ciliated = rimChase('E18c', [{ traitId: 'cilia', tier: TOP_TIER }]).from(1, player(1).does(alongTheRim));
    await expectDrainedEscape(ciliated, E18C_CONTACT_BREAK_TICK, E18C_RELEASE_TICK);
  });
});
