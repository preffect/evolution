// docs/game-design/constants-and-acceptance.md §13 G13: a wild killer, and the entry lift of the player it ate, run
// twice and hash-compared. The rest of §13 is game-design-session.gameplay.test.ts and game-design-controls.gameplay.test.ts.
//
// A is placed at the broth point at setup, which vacates the seeded seats and switches the spawns off
// (docs/testing/scenario-runner.md §8.1): an idle A meets nothing for six minutes and is re-placed by the fixture at
// tick 23 365 at level 1, mass 20, no DNA, exactly as the row states it; seat 0 is seated on demand beside it.

import { describe, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DNA_TAGS,
  ENGULF_SEAL_PROGRESS,
  PLAYER_LIFE_STATE,
  cumulativeDnaForLevel,
} from '@evolution/shared';
import { cellOf, massOf, progressOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { ZONE } from '../gameplay/placement.js';
import { CENTRE_DISTANCE_WU, E9_PAYOUT_TICK, E9_SEAL_TICK, PROGRESS_TOLERANCE } from './engulf-setups.js';
import { placedSolo } from './shared-setups.js';
import { PLACED_SEAT, absorbedThisTick } from './wild-setups.js';

const { growth, progression } = DEFAULT_BALANCE;
/** "Run to tick 23 365; ... pays out on tick 23 400 (6:30); A alive on tick 23 581 (23 400 + 180 + 1)." */
const G13_FIXTURE_TICK = 23_365;
const G13_RESPAWN_TICK = 23_581;
/** "Wild seat 0 at size 2.0 (mass ≈ 818.8 vs 20: massFactor 0.5, 1/36 per tick)". */
const G13_SEAT_SIZE = 2;
/** "World level 3.18 → A dnaCumulative = 140 = dnaCatchUpGift, level 3"; "mass = min(0.5 × 413.017, ENTRY_MAX_MASS) = 200". */
const G13_LIFTED_LEVEL = 3;
const G13_LIFTED_DNA = cumulativeDnaForLevel(G13_LIFTED_LEVEL, progression);
const G13_RESPAWN_MASS = 200;
/** "With A placed at dnaCumulative 200 (level 3) instead: gift 0, level 3, still mass 200." */
const G13_OWN_DNA = 200;
/** The first offer shown is the level-2 draft ("the protocell draft"); the level-3 one waits behind it. */
const FIRST_DRAFT_LEVEL = 2;
const ONE_TICK = 1;

const tagPointsOf = (view: EvolutionView): number =>
  DNA_TAGS.reduce((sum, tag) => sum + (progressOf(view, 0)?.dnaTagPoints[tag] ?? 0), 0);

/** A placed afresh at 23 365 with `dnaCumulative`, seat 0 seated 10 wu east so its engulf of A starts that tick. */
function g13(name: string, dnaCumulative: number) {
  return placedSolo(name)
    .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS })
    .atTick(G13_FIXTURE_TICK)
    .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: ZONE.broth, dnaCumulative })
    .atTick(G13_FIXTURE_TICK)
    .placeWildCell({ seat: PLACED_SEAT, sizeFactor: G13_SEAT_SIZE, eastOfFirstCellWu: CENTRE_DISTANCE_WU })
    .advance(G13_RESPAWN_TICK);
}

describe('game-design/constants-and-acceptance.md §13: a wild killer (G13)', () => {
  it('G13: eaten by the world at 6:30, A respawns lifted to the world floor with the whole lift as gift', async () => {
    const payoutTick = G13_FIXTURE_TICK + E9_PAYOUT_TICK - ONE_TICK;
    await g13('G13', 0)
      .expect('A at level 1 with no DNA on tick 23 365', (view) => [
        progressOf(view, 0)?.level,
        progressOf(view, 0)?.dnaCumulative,
      ])
      .atTick(G13_FIXTURE_TICK)
      .toEqual([1, 0])
      .expect("seat 0's engulf of A starts on 23 365", (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(G13_FIXTURE_TICK)
      .toBeGreaterThan(0)
      .expect('sealed on 23 382', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(G13_FIXTURE_TICK + E9_SEAL_TICK - ONE_TICK)
      .toBeCloseTo(ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE)
      .expect('A absorbed on 23 400', (view) => absorbedThisTick(view).map(([, playerId]) => playerId))
      .atTick(payoutTick)
      .toSatisfy((ids) => ids.length === 1 && ids[0] !== null, 'one cell_absorbed of a player')
      .expect('A spectating until 23 580', (view) => progressOf(view, 0)?.lifeState)
      .atTick(G13_RESPAWN_TICK - ONE_TICK)
      .toBe(PLAYER_LIFE_STATE.spectating)
      .expect('A alive on tick 23 581', (view) => progressOf(view, 0)?.lifeState)
      .atTick(G13_RESPAWN_TICK)
      .toBe(PLAYER_LIFE_STATE.alive)
      .expect('dnaCumulative = 140', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(G13_RESPAWN_TICK)
      .toBe(G13_LIFTED_DNA)
      .expect('all of it gift', (view) => progressOf(view, 0)?.dnaCatchUpGift)
      .atTick(G13_RESPAWN_TICK)
      .toBe(G13_LIFTED_DNA)
      .expect('level 3', (view) => progressOf(view, 0)?.level)
      .atTick(G13_RESPAWN_TICK)
      .toBe(G13_LIFTED_LEVEL)
      .expect('dnaTowardNextLevel = 0', (view) => progressOf(view, 0)?.dnaTowardNextLevel)
      .atTick(G13_RESPAWN_TICK)
      .toBe(0)
      .expect('the protocell draft shown', (view) => progressOf(view, 0)?.offer?.level)
      .atTick(G13_RESPAWN_TICK)
      .toBe(FIRST_DRAFT_LEVEL)
      .expect('score 0', (view) => progressOf(view, 0)?.score)
      .atTick(G13_RESPAWN_TICK)
      .toBe(0)
      .expect('no tag points', tagPointsOf)
      .atTick(G13_RESPAWN_TICK)
      .toBe(0)
      .expect('mass = ENTRY_MAX_MASS exactly', (view) => massOf(view, 0))
      .atTick(G13_RESPAWN_TICK)
      .toBe(Math.min(G13_RESPAWN_MASS, progression.ENTRY_MAX_MASS))
      .runDeterministic();
  });

  it('G13 with its own 200 DNA: no gift, level 3, still the entry mass', async () => {
    await g13('G13 own DNA', G13_OWN_DNA)
      .expect('gift 0', (view) => progressOf(view, 0)?.dnaCatchUpGift)
      .atTick(G13_RESPAWN_TICK)
      .toBe(0)
      .expect('dnaCumulative unchanged', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(G13_RESPAWN_TICK)
      .toBe(G13_OWN_DNA)
      .expect('level 3', (view) => progressOf(view, 0)?.level)
      .atTick(G13_RESPAWN_TICK)
      .toBe(G13_LIFTED_LEVEL)
      .expect('mass 200', (view) => massOf(view, 0))
      .atTick(G13_RESPAWN_TICK)
      .toBe(G13_RESPAWN_MASS)
      .runDeterministic();
  });
});
