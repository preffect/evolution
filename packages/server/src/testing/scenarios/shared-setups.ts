// What the design-table files share (docs/testing/scenario-runner.md §8.1): the two seeds bound to the DSL, the
// `decayed()` helper over the live balance, the tolerances the tables state, and PROGRESSION P7's
// late-join world, which GAME-DESIGN G9 reuses. Not a test file: the scenario files import it.

import {
  DEFAULT_BALANCE,
  DEFAULT_CELL_MODIFIERS,
  TICK_INTERVAL_S,
  cumulativeDnaForLevel,
  steerBlendPerTick,
  type CellModifiers,
  type TraitId,
} from '@evolution/shared';
import { PLACED_ROW_SEED, TABLE_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { ZONE, createDecayedHelper } from '../gameplay/index.js';

const { growth, ecology, progression, traits } = DEFAULT_BALANCE;
/** The share of the velocity gap a cell without an acceleration trait closes per tick. */
const STEER_BLEND = steerBlendPerTick(growth.CELL_ACCELERATION_SECONDS, TICK_INTERVAL_S);

/** "Mass assertions are ± 0.01 unless the row says otherwise" (docs/ecology/acceptance.md §8). */
export const MASS_TOLERANCE = 0.01;
/** "Speed within 0.5 wu/s" (E6, E8, G4). */
export const SPEED_TOLERANCE_WU_PER_SECOND = 0.5;
/** "Target 5 radii east": full throttle, never reached. */
export const FULL_THROTTLE_RADII = 5;

export const decayed = createDecayedHelper({
  cellStartingMass: growth.CELL_STARTING_MASS,
  massDecayRatePerSecond: ecology.MASS_DECAY_RATE_PER_SECOND,
});

/** A tier I modifier of `traitId` (docs/traits/model.md §2), or the identity when the trait does not set it. */
export function tierOneModifier(traitId: TraitId, field: keyof CellModifiers): number {
  return traits.TRAIT_TIERS[traitId][0][field] ?? DEFAULT_CELL_MODIFIERS[field];
}

/** The speed after `ticks` of full throttle from rest toward a cap held at `speedCapWuPerSecond`: cap × (1 − (1 − blend)^ticks). */
export function blendedSpeed(speedCapWuPerSecond: number, ticks: number): number {
  return speedCapWuPerSecond * (1 - (1 - STEER_BLEND) ** ticks);
}

/** The distance those ticks cover: the sum of each tick's `blendedSpeed` × the tick interval, in closed form. */
export function blendedTravelWu(speedCapWuPerSecond: number, ticks: number): number {
  const keptShare = 1 - STEER_BLEND;
  const unconvergedTicks = (keptShare / STEER_BLEND) * (1 - keptShare ** ticks);
  return speedCapWuPerSecond * TICK_INTERVAL_S * (ticks - unconvergedTicks);
}

/**
 * docs/ecology/food-and-spawn.md §1 rounding: motes = floor(fraction × mass / mote mass), the remainder dropped.
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
/**
 * The joiner's gift is `floor(ENTRY_DNA_FRACTION × median)`: this median lands it exactly on the level-2 threshold.
 * The ceiling keeps the fixture whole and adds under 1 DNA, so the floored gift never comes back one short.
 */
export const P7_FIXTURE_DNA = Math.ceil(cumulativeDnaForLevel(2, progression) / progression.ENTRY_DNA_FRACTION);
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
