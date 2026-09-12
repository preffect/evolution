// What the design-table files share (docs/TESTING.md §8.1): the two seeds bound to the DSL, the
// `decayed()` helper over the live balance, the tolerances the tables state, and PROGRESSION P7's
// late-join world, which GAME-DESIGN G9 reuses. Not a test file: the scenario files import it.

import { DEFAULT_BALANCE } from '@evolution/shared';
import { PLACED_ROW_SEED, TABLE_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { ZONE, createDecayedHelper } from '../gameplay/index.js';

const { growth, ecology } = DEFAULT_BALANCE;

/** "Mass assertions are ± 0.01 unless the row says otherwise" (docs/ECOLOGY.md §8). */
export const MASS_TOLERANCE = 0.01;
/** "Speed within 0.5 wu/s" (E6, E8, G4). */
export const SPEED_TOLERANCE_WU_PER_SECOND = 0.5;
/** "Target 5 radii east": full throttle, never reached. */
export const FULL_THROTTLE_RADII = 5;

export const decayed = createDecayedHelper({
  cellStartingMass: growth.CELL_STARTING_MASS,
  massDecayRatePerSecond: ecology.MASS_DECAY_RATE_PER_SECOND,
});

/**
 * docs/ECOLOGY.md §1 rounding: motes = floor(fraction × mass / mote mass), the remainder dropped.
 * The detritus mass a cell of `massAtRemoval` drops when it dies or dissolves.
 */
export function expectedDetritusMass(massAtRemoval: number): number {
  const motes = Math.floor((ecology.DETRITUS_MASS_FRACTION * massAtRemoval) / ecology.DETRITUS_MOTE_MASS);
  return ecology.DETRITUS_MOTE_MASS * motes;
}

/** "seed 42, 1 player (seeded world)". */
export function seededSolo(name: string) {
  return scenario(name).seed(TABLE_SEED).players(1);
}

/** A placed row's solo world: the placed-row seed, the seeded spawns switched off by the first placement. */
export function placedSolo(name: string) {
  return scenario(name).seed(PLACED_ROW_SEED).players(1);
}

/** "The third player joins before tick 6000 steps": the join is stamped 6000, the mass fixture the tick before it. */
export const P7_JOIN_TICK = 6000;
export const P7_FIXTURE_DNA = 120;
export const P7_FIXTURE_MASS = 400;
/** B sits east of A far enough that neither placement nor separation touches the other. */
const B_EAST_OF_A_WU = 700;

/**
 * Two placed players with 120 DNA at setup, 400 mass set by the fixture before the join (the
 * runner applies a tick's joins before its fixtures, so the mass lands one tick earlier and one
 * decay tick short of 400: within the row's tolerance), and a third player who joins at tick 6000.
 */
export function p7Setup(name: string) {
  const startingMass = growth.CELL_STARTING_MASS;
  return scenario(name)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: startingMass, dnaCumulative: P7_FIXTURE_DNA })
    .placeCell({ playerIndex: 1, mass: startingMass, dnaCumulative: P7_FIXTURE_DNA, eastOfFirstCellWu: B_EAST_OF_A_WU })
    .atTick(P7_JOIN_TICK - 1)
    .placeCell({ playerIndex: 0, mass: P7_FIXTURE_MASS, at: ZONE.broth })
    .atTick(P7_JOIN_TICK - 1)
    .placeCell({ playerIndex: 1, mass: P7_FIXTURE_MASS, eastOfFirstCellWu: B_EAST_OF_A_WU })
    .playerJoinsAt(P7_JOIN_TICK);
}
