// docs/game-design/phases.md §14.15, the era clock and the pool's move over whole rounds on the Evolution module, with
// every era in play (seed 42): PH1 (the move at 10:00 without stopping play), PH3 (the dish leaves with the move), PH13
// (results at 25:00 and a new game from the dish) on one 91 200-tick run, and PH5 (a 600 s round never reaches the pool).
// The pool's food (ticket #870): its swarms and fragments lie clear of the landing, and the dish's vent and gel do not
// follow the players in.
// PH3's landmark waits on ticket #872; PH17, the move's wire and cameras, is `lobby/era-move-wire.integration.test.ts`.
// Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  FOOD_KIND,
  GAME_ERA,
  GAME_ERA_ORDER,
  ROUND_PHASE,
  TICK_INTERVAL_S,
  distanceBetween,
  type GameEffect,
  type GameEra,
  type RoundPhase,
} from '@evolution/shared';
import { ERA_PLAYER, ERA_TABLE_SEED, eraMovesIn, startEraRoom } from '../../testing/era-room.js';
import { COLONIES_ON_ROUND_SECONDS } from '../../testing/world-builders.js';
import { isPlayerCell } from '../world/entities.js';
import { findCellOfPlayer, findPlayer } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import { mapDishPointToPool } from './pool-move.js';

const { eras, pool, session, world: dish } = DEFAULT_BALANCE;
/** The dish-only game's length (phases.md §14.2.3). */
const DISH_ONLY_ROUND_SECONDS = 600;
/** The ticks the rows name (60 Hz, a round started at 0). */
const POOL_WARNING_TICK = 35_400;
const POOL_FIRST_TICK = 36_000;
const COLONIES_FIRST_TICK = 61_200;
const ROUND_END_TICK = 90_000;
const PH13_END_TICK = 91_200;
const PH5_END_TICK = 37_200;
/** PH1's placement: on tick 35 999, at (1 200, −600), mass 500, level 5, the paramecium form. */
const PH1 = {
  placedAtTick: POOL_FIRST_TICK - 1,
  position: { x: 1200, y: -600 },
  landing: { x: 120, y: -60 },
  mass: 500,
  level: 5,
  traits: ['nucleoid', 'mitochondrion', 'nuclear_envelope', 'cilia', 'paramecium_cilia'],
};
/** "± separation": an idle cell alone in the dish drifts by far less than this over the two ticks. */
const LANDING_TOLERANCE_WU = 1;
/** A wild cell or giant moves one tick between 35 999 and the move: under this once mapped into the pool (wu, pool). */
const LEFTOVER_TOLERANCE_WU = 1;
/** The footprint: the dish's radius over the scale step (300 wu). */
const FOOTPRINT_RADIUS_WU = dish.DISH_RADIUS / eras.ERA_SCALE_STEP;
const POOL_CENTRE = { x: 0, y: 0 };

/** What a row reads of a tick as it ends. */
interface TickRecord {
  readonly era: GameEra;
  readonly phase: RoundPhase;
  readonly effects: readonly GameEffect[];
}

function recordOf(world: WorldState, effects: readonly GameEffect[]): TickRecord {
  return { era: world.eraMovedInto, phase: world.roundPhase, effects };
}

function cellOf(world: WorldState) {
  const cell = findCellOfPlayer(world, ERA_PLAYER);
  if (cell === undefined) throw new Error('the era row’s player has no cell');
  return cell;
}

/** The mass the cell has after one metabolism step from `mass`: what its flow says it lost this tick. */
function afterOneTickOfFlow(world: WorldState, mass: number): number {
  const rates = Object.values(world.massFlow.metabolismByPlayer[ERA_PLAYER]?.ratesPerSecond ?? {});
  return mass + rates.reduce((total, rate) => total + rate, 0) * TICK_INTERVAL_S;
}

describe('phases.md §14.15 PH1, PH3 and PH13: one idle player through the whole 25-minute game', () => {
  it('moves into the pool at 10:00 without stopping play, the dish left behind, and starts again in the dish', async () => {
    const room = startEraRoom({ roundDurationSeconds: COLONIES_ON_ROUND_SECONDS });
    const { world, handle } = room;
    expect(world.poolLayout).not.toBeNull(); // drawn when the eras were put in play, long before the warning
    const records = new Map<number, TickRecord>();
    const keep = (tick: number) => (stepped: WorldState, effects: readonly GameEffect[]) => {
      if (stepped.tick === tick) records.set(tick, recordOf(stepped, effects));
    };
    await room.stepTo(PH1.placedAtTick - 1);
    handle.setPlayer(ERA_PLAYER, { position: PH1.position, mass: PH1.mass, level: PH1.level, traits: PH1.traits });
    const score = findPlayer(world, ERA_PLAYER)!.dnaCumulative;
    await room.stepTo(PH1.placedAtTick, keep(PH1.placedAtTick));
    const leftoverPoints = world.cells
      .filter((each) => !isPlayerCell(each))
      .map((each) => mapDishPointToPool(each, world.balance));
    const dishFragmentIds = new Set(world.dnaFragments.map((fragment) => fragment.id));
    await room.stepTo(POOL_FIRST_TICK, keep(POOL_FIRST_TICK));

    // PH1: the dish on 35 999, the pool on 36 000, the round playing throughout.
    expect(records.get(PH1.placedAtTick)).toMatchObject({ era: GAME_ERA.dish, phase: ROUND_PHASE.playing });
    expect(records.get(POOL_FIRST_TICK)).toMatchObject({ era: GAME_ERA.pool, phase: ROUND_PHASE.playing });
    expect(eraMovesIn(records.get(POOL_FIRST_TICK)!.effects)).toEqual([[POOL_FIRST_TICK, GAME_ERA.pool]]);
    const cell = cellOf(world);
    expect(distanceBetween(cell, PH1.landing)).toBeLessThan(LANDING_TOLERANCE_WU);
    expect(cell.mass).toBeCloseTo(afterOneTickOfFlow(world, pool.POOL_ARRIVAL_MASS), 9);
    expect(cell.mass).toBeLessThan(pool.POOL_ARRIVAL_MASS);
    const player = findPlayer(world, ERA_PLAYER)!;
    expect(player.level).toBe(PH1.level);
    expect(player.ownedTraits.map((owned) => owned.traitId)).toEqual(PH1.traits);
    expect(player.dnaCumulative).toBe(score);
    expect(room.effects.filter((effect) => effect.kind === EFFECT_KIND.eraWarning)).toEqual([
      { kind: EFFECT_KIND.eraWarning, tick: POOL_WARNING_TICK, era: GAME_ERA.pool },
    ]);
    // The dish's vent and gel end at the move: the cell landed inside the old vent decays at the broth rate.
    expect(world.gelPatches).toEqual([]);
    expect(Math.abs(world.massFlow.metabolismByPlayer[ERA_PLAYER]!.ratesPerSecond.vent)).toBe(0);

    // PH3: on 36 001 no dish mote, fragment, wild cell or giant remains; each wild cell and giant alive on 35 999 is
    // one green speck of ERA_LEFTOVER_SPECK_MASS at its mapped point, inside the footprint, and no other mote or
    // fragment lies within ERA_LANDING_CLEAR_RADIUS: the swarms and the pool's fragments are placed outside it.
    await room.stepTo(POOL_FIRST_TICK + 1);
    const inSwarms = new Set(world.poolSwarms!.flatMap((swarm) => swarm.memberIds));
    const leftovers = world.food.filter((mote) => !inSwarms.has(mote.id));
    expect(leftoverPoints.length).toBeGreaterThan(0);
    expect(leftovers.map((mote) => [mote.kind, mote.mass])).toEqual(
      leftoverPoints.map(() => [FOOD_KIND.greenSpeck, eras.ERA_LEFTOVER_SPECK_MASS]),
    );
    for (const [index, mote] of leftovers.entries()) {
      expect(distanceBetween(mote, leftoverPoints[index]!)).toBeLessThan(LEFTOVER_TOLERANCE_WU);
      expect(distanceBetween(mote, POOL_CENTRE)).toBeLessThanOrEqual(FOOTPRINT_RADIUS_WU);
    }
    expect(inSwarms.size).toBe(pool.POOL_SWARM_COUNT * pool.POOL_SWARM_SIZE);
    for (const item of [...world.food.filter((mote) => inSwarms.has(mote.id)), ...world.dnaFragments]) {
      expect(distanceBetween(item, POOL_CENTRE)).toBeGreaterThan(eras.ERA_LANDING_CLEAR_RADIUS);
    }
    expect(world.food.every((mote) => mote.kind === FOOD_KIND.greenSpeck)).toBe(true);
    expect(world.dnaFragments.some((fragment) => dishFragmentIds.has(fragment.id))).toBe(false);
    expect(world.cells.map((each) => each.playerId)).toEqual([ERA_PLAYER]);

    // PH13: results on 90 000 exactly, the colonies opened on the way; a new game in the dish on 91 200, seed 43.
    await room.stepTo(PH13_END_TICK, (stepped, effects) => {
      if (stepped.tick === ROUND_END_TICK - 1 || stepped.tick === ROUND_END_TICK) {
        records.set(stepped.tick, recordOf(stepped, effects));
      }
    });
    expect(records.get(ROUND_END_TICK - 1)?.phase).toBe(ROUND_PHASE.playing);
    expect(records.get(ROUND_END_TICK)?.phase).toBe(ROUND_PHASE.results);
    expect(eraMovesIn(room.effects)).toEqual([
      [POOL_FIRST_TICK, GAME_ERA.pool],
      [COLONIES_FIRST_TICK, GAME_ERA.colonies],
    ]);
    expect(world.roundPhase).toBe(ROUND_PHASE.playing);
    expect(world.eraMovedInto).toBe(GAME_ERA.dish);
    expect(world.seed).toBe(ERA_TABLE_SEED + session.ROUND_SEED_INCREMENT);
    expect(findPlayer(world, ERA_PLAYER)?.level).toBe(1);
    expect(cellOf(world).stage).toBe(CELL_STAGE.protocell);
  });
});

describe('phases.md §14.15 PH5: a 600 s round with every era in play is today’s round', () => {
  it('reaches results on 36 000 with no era warning or move, and rematches in the dish on 37 200', async () => {
    const room = startEraRoom({ roundDurationSeconds: DISH_ONLY_ROUND_SECONDS, erasInPlay: GAME_ERA_ORDER });
    const phases = new Map<number, RoundPhase>();
    await room.stepTo(PH5_END_TICK, (stepped) => phases.set(stepped.tick, stepped.roundPhase));
    expect(phases.get(POOL_FIRST_TICK - 1)).toBe(ROUND_PHASE.playing);
    expect(phases.get(POOL_FIRST_TICK)).toBe(ROUND_PHASE.results);
    expect(phases.get(PH5_END_TICK - 1)).toBe(ROUND_PHASE.results);
    const eraKinds: readonly string[] = [EFFECT_KIND.eraWarning, EFFECT_KIND.eraMoved];
    expect(room.effects.filter((effect) => eraKinds.includes(effect.kind))).toEqual([]);
    expect(room.world.roundPhase).toBe(ROUND_PHASE.playing);
    expect(room.world.eraMovedInto).toBe(GAME_ERA.dish);
    expect(room.world.seed).toBe(ERA_TABLE_SEED + session.ROUND_SEED_INCREMENT);
  });
});
