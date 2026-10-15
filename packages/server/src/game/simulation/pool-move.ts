// The move from the dish to the rock pool (docs/game-design/phases.md §14.4.2): what the simulation does on the pool
// era's first tick, in the design's order, deterministic. The step runs it through the era clock (`era-moves.ts`),
// after step 2 and before step 3, so the move tick's own movement, eating and metabolism already run in the pool.
//
//   1 end what cannot cross        every engulf ends with no transfer, every sprint ends, every held list empties
//   2 fill the pool                its food (ticket #870), wild seats (ticket #871) and creatures (ticket #872)
//   3 the footprint                a dish point p becomes pool point p / ERA_SCALE_STEP (`mapDishPointToPool`)
//   4 the leftovers                the dish's wild cells, giants, motes and fragments leave, each cell a green speck;
//                                  its spawners stop
//   5 the players                  each cell to its mapped point at POOL_ARRIVAL_MASS, its velocity scaled down
//   6 the no-form gift             ticket #869
//   7 the landing                  the landmark and the clear zone: tickets #870 and #872
//   8 the grace                    `move-grace.ts`
//   9 the camera and the wire      serialisation state, never the step's (wire-contract.md §4 "The move")

import { FOOD_KIND, type BalanceConfig, type Vec2 } from '@evolution/shared';
import { withdrawCell } from '../session/death.js';
import { isPlayerCell, type CellRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { abortAllEngulfs } from './engulf-state.js';
import { startMoveGrace } from './move-grace.js';
import { spawnFoodMote } from './spawn-mote.js';
import { clearFoodAndStopSpawners } from './spawner.js';

/** A sprint ended by the move: none left to run (its cooldown runs on as after any sprint). */
const NO_SPRINT_TICKS = 0;

/** Step 3: the dish maps onto a disc at the pool's centre, `DISH_RADIUS / ERA_SCALE_STEP` across. */
export function mapDishPointToPool(point: Vec2, balance: Pick<BalanceConfig, 'eras'>): Vec2 {
  return { x: point.x / balance.eras.ERA_SCALE_STEP, y: point.y / balance.eras.ERA_SCALE_STEP };
}

/**
 * Step 1: every engulf ends with no mass or DNA moving (predator and prey both go free, each with its `cell_released`),
 * every sprint ends, and every held list empties with no payout, no credit and no `eat`, before step 6's gift.
 */
function endWhatCannotCross(world: WorldState): void {
  abortAllEngulfs(world);
  for (const cell of world.cells) {
    cell.sprintRemainingTicks = NO_SPRINT_TICKS;
    cell.latchedBacteria = [];
  }
}

/**
 * Step 4: every cell that is not a player's (the wild cells and the giants) leaves with its seat, and the dish's motes
 * and fragments vanish; the dish's spawners stop, since the pool's food is its own (ticket #870). Each wild cell and
 * giant leaves one green speck at its mapped point, placed after the dish's motes are gone.
 */
function clearTheDish(world: WorldState, balance: BalanceConfig): void {
  const leftCells = world.cells.filter((candidate) => !isPlayerCell(candidate));
  for (const cell of leftCells) {
    withdrawCell(world, cell);
  }
  world.wildSeats = [];
  world.giantSeats = [];
  clearFoodAndStopSpawners(world);
  for (const cell of leftCells) {
    placeLeftoverSpeck(world, mapDishPointToPool(cell, balance), balance);
  }
}

/** A leftover of step 4: one green speck at `point`, at `ERA_LEFTOVER_SPECK_MASS` in place of the kind's own mass. */
function placeLeftoverSpeck(world: WorldState, point: Vec2, balance: BalanceConfig): void {
  const speck = spawnFoodMote(world, { kind: FOOD_KIND.greenSpeck, variant: null, at: point });
  speck.mass = balance.eras.ERA_LEFTOVER_SPECK_MASS;
}

/** A latched point in dish units (a steering target, a fixture's pin) as the same point in the pool. */
function mapLatchedPoint(x: number | null, y: number | null, balance: BalanceConfig): [number | null, number | null] {
  if (x === null || y === null) return [x, y];
  const mapped = mapDishPointToPool({ x, y }, balance);
  return [mapped.x, mapped.y];
}

/**
 * Step 5: the cell to its mapped point at `POOL_ARRIVAL_MASS`, keeping its heading with its velocity divided by the
 * scale step; its latched target and pin map with it, so it keeps steering where it was. Cells that now overlap
 * separate by the ordinary rule over the next ticks.
 */
function landPlayerCell(cell: CellRecord, balance: BalanceConfig): void {
  const scaleStep = balance.eras.ERA_SCALE_STEP;
  const landing = mapDishPointToPool(cell, balance);
  cell.x = landing.x;
  cell.y = landing.y;
  cell.velocityX /= scaleStep;
  cell.velocityY /= scaleStep;
  [cell.targetX, cell.targetY] = mapLatchedPoint(cell.targetX, cell.targetY, balance);
  [cell.pinnedX, cell.pinnedY] = mapLatchedPoint(cell.pinnedX, cell.pinnedY, balance);
  setCellMass(cell, balance.pool.POOL_ARRIVAL_MASS, balance);
}

/** The pool's move, steps 1 to 8 (step 9 is the serializer's), on the tick the era clock reaches the pool. */
export function runPoolMove(world: WorldState, context: StepContext): void {
  const { balance } = context;
  endWhatCannotCross(world);
  clearTheDish(world, balance);
  for (const cell of world.cells) {
    landPlayerCell(cell, balance);
  }
  startMoveGrace(world, balance);
}
