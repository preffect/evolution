// What the evolving-world rows share (docs/ecology/acceptance.md §8.1 W2–W10, docs/game-design/constants-and-acceptance.md
// §13 G13): the seat the rows place, the world clock's ticks, the numbers the rows state and the selectors they read
// through. Not a test file; the wild scenario files import it.

import {
  CELL_KIND,
  CELL_STAGE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  FOOD_KIND,
  RADIANS_PER_FULL_TURN,
  TICK_HZ,
  WORLD_ORGANISM_ID,
  distanceBetween,
  ticksToSeconds,
  worldReference,
  type CellStage,
  type CellView,
  type Vec2,
} from '@evolution/shared';
import type { EvolutionScenarioSnapshot } from '../gameplay/evolution-adapter.js';
import {
  cellOf,
  effectsOfKind,
  wildCellOf,
  wildCellsOf,
  wildSeatOf,
  type EvolutionView,
} from '../gameplay/evolution-views.js';
import { player, type PlayerScript } from '../gameplay/index.js';
import { holdPopulationsAtZero, type EvolutionScenarioBuilder } from './shared-setups.js';

const { wildCells, growth, worldClock } = DEFAULT_BALANCE;

/** "Seat 0": the seat every placed W row pins. */
export const PLACED_SEAT = 0;
/** "Seat 0 pinned at spread 1.0". */
export const WORLD_SPREAD = 1;
/** The ticks of the world's level-ups: 10 800 (`prokaryote`), 21 600 (`endosymbiosis`), 32 400 (`eukaryote`). */
export const WORLD_LEVEL_TICKS = worldClock.WORLD_LEVEL_SECONDS * TICK_HZ;
export const HUNTING_TICK = 2 * WORLD_LEVEL_TICKS;
export const EUKARYOTE_TICK = 3 * WORLD_LEVEL_TICKS;
/** A seat vacated on tick t seats a new cell on t + 600 + 1 (W4: 637). */
export const WILD_RESPAWN_TICKS = wildCells.WILD_CELL_RESPAWN_SECONDS * TICK_HZ;
/** "Within [14, 26] (20 × spread)": the lightest and heaviest protocell seat. */
export const LIGHTEST_SEAT_MASS = growth.CELL_STARTING_MASS * (1 - wildCells.WILD_CELL_MASS_SPREAD);
export const HEAVIEST_SEAT_MASS = growth.CELL_STARTING_MASS * (1 + wildCells.WILD_CELL_MASS_SPREAD);
/** "Points at A within 5°" (W6, W7). */
export const HEADING_TOLERANCE_DEGREES = 5;
const DEGREES_PER_FULL_TURN = 360;

/** `worldMass(t / TICK_HZ)` = 20 + t / 60 for the tick in progress (docs/ecology/acceptance.md §8.1). */
export function worldMassAtTick(tick: number): number {
  return worldReference(ticksToSeconds(tick), DEFAULT_BALANCE).worldMass;
}

export const placedSeat = (view: EvolutionView) => wildSeatOf(view, PLACED_SEAT);
export const placedSeatCell = (view: EvolutionView): CellView | undefined => wildCellOf(view, PLACED_SEAT);
export const massOfSeat = (view: EvolutionView): number | undefined => placedSeatCell(view)?.mass;
export const progressOfSeat = (view: EvolutionView): number | undefined => placedSeatCell(view)?.engulfProgress;
export const statesOfSeat = (view: EvolutionView): string[] | undefined => placedSeatCell(view)?.states;
export const xOfSeat = (view: EvolutionView): number | undefined => placedSeatCell(view)?.x;
export const sprintOfSeat = (view: EvolutionView): number | undefined => placedSeatCell(view)?.sprintRemainingTicks;
/** The seat's latched target, or `undefined` while it has none (before its first decision). */
export function targetOfSeat(view: EvolutionView): Vec2 | undefined {
  const seat = placedSeat(view);
  return seat === undefined || seat.targetX === null || seat.targetY === null
    ? undefined
    : { x: seat.targetX, y: seat.targetY };
}

/** The centre distance between the placed player's cell and the seat's. */
export function distanceFromSeat(view: EvolutionView, playerIndex: number): number | undefined {
  const player = cellOf(view, playerIndex);
  const wild = placedSeatCell(view);
  return player === undefined || wild === undefined ? undefined : distanceBetween(player, wild);
}

/** The angle (°) between the seat's velocity and the direction from its centre to `target`; 0 = straight at it. */
export function headingErrorOfSeat(view: EvolutionView, target: Vec2 | undefined): number | undefined {
  const wild = placedSeatCell(view);
  if (wild === undefined || target === undefined) {
    return undefined;
  }
  const heading = Math.atan2(wild.velocityY, wild.velocityX);
  const bearing = Math.atan2(target.y - wild.y, target.x - wild.x);
  const turns = Math.abs(heading - bearing) / RADIANS_PER_FULL_TURN;
  return Math.min(turns, 1 - turns) * DEGREES_PER_FULL_TURN;
}

/** Due east, the W7 flee direction. */
export const EAST: Vec2 = { x: 1, y: 0 };
export function headingErrorOfSeatFromEast(view: EvolutionView): number | undefined {
  const wild = placedSeatCell(view);
  return wild === undefined ? undefined : headingErrorOfSeat(view, { x: wild.x + EAST.x, y: wild.y + EAST.y });
}

/** W2: a level-1 traitless protocell of the world organism. */
export const isWorldProtocell = (cell: CellView): boolean =>
  cell.kind === CELL_KIND.wild &&
  cell.organismId === WORLD_ORGANISM_ID &&
  cell.level === 1 &&
  cell.traits.length === 0 &&
  cell.stage === CELL_STAGE.protocell;

/** W2: the closest pair of cell centres, wild or player. */
export function closestCentrePair(view: EvolutionView): number {
  const cells = view.snapshot.cells;
  let closest = Number.POSITIVE_INFINITY;
  for (const [index, cell] of cells.entries()) {
    for (const other of cells.slice(index + 1)) {
      closest = Math.min(closest, distanceBetween(cell, other));
    }
  }
  return closest;
}

export const farthestWildFromOrigin = (view: EvolutionView): number =>
  Math.max(...wildCellsOf(view).map((cell) => Math.hypot(cell.x, cell.y)));
export const lightestWild = (view: EvolutionView): number => Math.min(...wildCellsOf(view).map((cell) => cell.mass));
export const heaviestWild = (view: EvolutionView): number => Math.max(...wildCellsOf(view).map((cell) => cell.mass));
export const motesInsideWildCells = (view: EvolutionView): number =>
  view.snapshot.food.spawned.filter((mote) =>
    wildCellsOf(view).some((cell) => distanceBetween(mote, cell) <= cell.radius),
  ).length;

/** W3: every wild cell at `level` and `stage`, owning exactly `traitIds` in build order, all at tier I. */
export const everyWildCellAtLevel =
  (level: number, stage: CellStage, traitIds: readonly string[]) =>
  (view: EvolutionView): boolean =>
    wildCellsOf(view).every(
      (cell) =>
        cell.level === level &&
        cell.stage === stage &&
        cell.traits.map((trait) => trait.traitId).join(',') === traitIds.join(',') &&
        cell.traits.every((trait) => trait.tier === 1),
    );

/** W3: the largest miss, over every seated wild cell, of `mass = expectedWorldMass × spread`. */
export function worstSpreadMiss(expectedWorldMass: number): (view: EvolutionView) => number {
  return (view) =>
    Math.max(
      ...view.snapshot.wildSeats.map((seat) => {
        const cell = view.snapshot.cells.find((candidate) => candidate.id === seat.cellId);
        return cell === undefined
          ? Number.POSITIVE_INFINITY
          : Math.abs(cell.mass - expectedWorldMass * seat.massSpreadFactor);
      }),
    );
}

/** The `cell_absorbed` effects of this tick as `[cellId, playerId]` pairs. */
export const absorbedThisTick = (view: EvolutionView): (string | null)[][] =>
  effectsOfKind(view, EFFECT_KIND.cellAbsorbed).map((effect) => [effect.cellId, effect.playerId]);

/** W3, W9: what a window's snapshots show — the kinds spawned and the deaths of the player whose script counts. */
export interface WindowCounts {
  algae: number;
  bacterium: number;
  /** `cell_absorbed` of the counting player: each death takes its per-player share off the spawn rate (W9). */
  deaths: number;
}

export const createWindowCounts = (): WindowCounts => ({ algae: 0, bacterium: 0, deaths: 0 });

/**
 * Counts the algae and bacteria in every snapshot the script sees, and the player's own deaths: with both
 * populations held at 0 before every step (`holdPopulationsAtZero`), a snapshot holds that tick's spawns alone,
 * so the script scheduled from the tick after the window's first to the tick after its last counts exactly the
 * window's spawns. The script runs whether or not the player has a cell.
 */
export function countWindow(counts: WindowCounts): PlayerScript<EvolutionScenarioSnapshot> {
  return (context) => {
    for (const mote of context.snapshot.food.spawned) {
      if (mote.kind === FOOD_KIND.algae) counts.algae += 1;
      if (mote.kind === FOOD_KIND.bacterium) counts.bacterium += 1;
    }
    for (const effect of context.snapshot.effects) {
      if (effect.kind === EFFECT_KIND.cellAbsorbed && effect.playerId === context.actorId) counts.deaths += 1;
    }
    return null;
  };
}

export function algaeShareOf(counts: WindowCounts): number {
  return counts.algae / (counts.algae + counts.bacterium);
}

/** W3, W9: E2's window length, 3 010 ticks, so that no count lands on the final tick (docs/ecology/acceptance.md §8). */
export const WILD_WINDOW_TICKS = 3010;
/** Both runs of `runDeterministic` feed the script: the counts are doubled, the share and the deaths per run are not. */
export const RUNS_PER_ROW = 2;
const ONE_TICK = 1;

/** The E14 fixture from `windowStart` for `WILD_WINDOW_TICKS`, the kinds and deaths counted by a script one tick behind. */
export function heldWindow(run: EvolutionScenarioBuilder, windowStart: number) {
  const windowEnd = windowStart + WILD_WINDOW_TICKS - ONE_TICK;
  const counts = createWindowCounts();
  holdPopulationsAtZero(run, windowStart, windowEnd)
    .between(windowStart + ONE_TICK, windowEnd + ONE_TICK, player(0).does(countWindow(counts)))
    .capture('food at window start', (view) => view.snapshot.spawnedCounts.food)
    .atTick(windowStart - ONE_TICK);
  return { counts, windowEnd };
}
