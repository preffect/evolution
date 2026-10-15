// docs/game-design/phases.md §14.15 PH19 (§14.2.4): `debug_set_era` at tick 600 moves `roundStartTick` back so tick
// 601 is the era's first, never the tick counter; the step runs every crossed move in era order (a jump to the
// colonies runs the pool's move first, on the same tick); the jump is recorded, so `debug_export_replay` reproduces
// the final state hash across the move; the hash covers the pool's state; and no jump goes back. B also pins the
// leftovers (one green speck per wild cell and giant, §14.4.2 step 4). The cameras across the move are ticket #868's
// wire part. Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENTITY_KIND,
  GAME_ERA,
  createTestCopepodLane,
  createTestSurge,
  distanceBetween,
  playerId,
  secondsToTicks,
  type EntityId,
  type GameEffect,
  type GameEra,
} from '@evolution/shared';
import { ERA_PLAYER, eraMovesIn, startEraRoom, type EraRoom } from '../../testing/era-room.js';
import { COLONIES_ON_ROUND_SECONDS } from '../../testing/world-builders.js';
import { DebugRequestError } from '../debug/debug-request-error.js';
import { computeStateHash } from '../world/state-hash.js';
import { isPlayerCell, type FoodMoteRecord } from '../world/entities.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { Replay } from './replay-format.js';
import { replay } from './replay-runner.js';

const { eras, pool, world: dish } = DEFAULT_BALANCE;
/** PH19's ticks: the jump at 600, the era's first tick 601, the run to 1 200, and the round start the jump leaves. */
const JUMP_TICK = 600;
const MOVE_TICK = JUMP_TICK + 1;
const END_TICK = 1200;
const PH19_ROUND_START_TICK = -35_399;
/** The footprint: the dish's radius over the scale step (300 wu). */
const FOOTPRINT_RADIUS_WU = dish.DISH_RADIUS / eras.ERA_SCALE_STEP;
/**
 * The grace's player pair (§14.4.2 step 8, "players included"): a eukaryote of 400 held over a 60, its centre 5 wu off
 * the prey's, so the engulf would start on any tick the grace allows. A eukaryote swallows whatever the swallow stage.
 */
const PREDATOR = playerId('bob');
const GRACE_PAIR = {
  predator: {
    mass: 400,
    level: 4,
    traits: ['nucleoid', 'mitochondrion', 'nuclear_envelope'],
    position: { x: 0, y: 0 },
  },
  prey: { mass: pool.POOL_ARRIVAL_MASS, position: { x: 5, y: 0 } },
};

/** The mass `cellId` gained by eating among one tick's `effects`: a leftover speck it landed on (§14.4.2 step 4). */
function massEatenBy(cellId: EntityId, effects: readonly GameEffect[]): number {
  return effects
    .flatMap((effect) => (effect.kind === EFFECT_KIND.eat && effect.cellId === cellId ? [effect.massGained] : []))
    .reduce((total, massGained) => total + massGained, 0);
}

/**
 * What step 4 left on the move tick: the dish's wild cells and giants on 600, the specks no swarm holds lying and the
 * motes eaten on 601 (a swarm's specks lie outside the landing, so the player eats only leftovers on that tick).
 */
interface Leftovers {
  readonly cellsLeft: number;
  readonly specksLying: readonly FoodMoteRecord[];
  readonly motesEaten: number;
}

function motesEatenIn(effects: readonly GameEffect[]): number {
  return effects.filter((effect) => effect.kind === EFFECT_KIND.eat && effect.eatenKind === ENTITY_KIND.foodMote)
    .length;
}

/**
 * A fresh PH19 room jumped to `era` at tick 600, its player's cell as it stood on the move tick with the mass it ate
 * there and what step 4 left, run to 1 200.
 */
async function jumpAndRun(era: GameEra) {
  const room = startEraRoom({ roundDurationSeconds: COLONIES_ON_ROUND_SECONDS });
  await room.stepTo(JUMP_TICK);
  const cellsLeft = room.world.cells.filter((each) => !isPlayerCell(each)).length;
  const jump = room.handle.setEra(era);
  let landing: { x: number; y: number; mass: number; massEaten: number } | undefined;
  let leftovers: Leftovers | undefined;
  await room.stepTo(END_TICK, (world, effects) => {
    if (world.tick !== MOVE_TICK) return;
    const cell = findCellOfPlayer(world, ERA_PLAYER);
    if (cell !== undefined)
      landing = { x: cell.x, y: cell.y, mass: cell.mass, massEaten: massEatenBy(cell.id, effects) };
    const inSwarms = new Set(world.poolSwarms!.flatMap((swarm) => swarm.memberIds));
    const specksLying = world.food.filter((mote) => !inSwarms.has(mote.id)).map((mote) => ({ ...mote }));
    leftovers = { cellsLeft, specksLying, motesEaten: motesEatenIn(effects) };
  });
  return { room, jump, landing, leftovers };
}

/**
 * Holds the pair in contact before every step from the move's next tick on and returns the first tick an engulf of the
 * prey started on, or null if none had by `lastTick`.
 */
async function firstEngulfStartHeld(room: EraRoom, lastTick: number): Promise<number | null> {
  room.handle.setPlayer(PREDATOR, GRACE_PAIR.predator);
  while (room.world.tick < lastTick) {
    room.handle.setPlayer(PREDATOR, { position: GRACE_PAIR.predator.position });
    room.handle.setPlayer(ERA_PLAYER, GRACE_PAIR.prey);
    await room.stepTo(room.world.tick + 1);
    if (findCellOfPlayer(room.world, ERA_PLAYER)?.engulfedByCellId !== null) return room.world.tick;
  }
  return null;
}

function expectReplayReproduces(room: EraRoom): void {
  const recording = JSON.parse(JSON.stringify(room.handle.exportReplay())) as Replay;
  expect(replay(recording).hash).toBe(room.handle.computeStateHash());
}

describe('phases.md §14.15 PH19: debug_set_era', () => {
  it('A: a jump to the pool at 600 starts it on 601, replays to the same hash, which covers the pool’s state', async () => {
    const { room, jump } = await jumpAndRun(GAME_ERA.pool);
    expect(jump).toMatchObject({ era: GAME_ERA.pool, firstTick: MOVE_TICK, roundStartTick: PH19_ROUND_START_TICK });
    expect(room.world.roundStartTick).toBe(PH19_ROUND_START_TICK);
    expect(room.world.tick).toBe(END_TICK);
    expect(eraMovesIn(room.effects)).toEqual([[MOVE_TICK, GAME_ERA.pool]]);
    expectReplayReproduces(room);
    const hash = computeStateHash(room.world);
    room.world.surge = createTestSurge();
    expect(computeStateHash(room.world)).not.toBe(hash);
    room.world.surge = null;
    room.world.copepodLane = createTestCopepodLane();
    expect(computeStateHash(room.world)).not.toBe(hash);
    room.world.copepodLane = null;
    expect(() => room.handle.setEra(GAME_ERA.dish)).toThrow(DebugRequestError);
  });

  it('B: a jump to the colonies runs the pool’s move first, then the colonies’, on 601, and replays', async () => {
    const { room, landing, leftovers } = await jumpAndRun(GAME_ERA.colonies);
    expect(eraMovesIn(room.effects)).toEqual([
      [MOVE_TICK, GAME_ERA.pool],
      [MOVE_TICK, GAME_ERA.colonies],
    ]);
    expect(room.world.eraMovedInto).toBe(GAME_ERA.colonies);
    expect(distanceBetween(landing!, { x: 0, y: 0 })).toBeLessThanOrEqual(FOOTPRINT_RADIUS_WU);
    // The move tick's own metabolism runs in the pool: the arrival mass, less a little decay, plus any speck eaten.
    const massBeforeEating = landing!.mass - landing!.massEaten;
    expect(massBeforeEating).toBeLessThan(pool.POOL_ARRIVAL_MASS);
    expect(massBeforeEating).toBeGreaterThan(pool.POOL_ARRIVAL_MASS - 1);
    // The leftovers placed: one speck per wild cell and giant, lying in the footprint at the leftover mass or eaten.
    expect(leftovers!.cellsLeft).toBeGreaterThan(0);
    expect(leftovers!.specksLying.length + leftovers!.motesEaten).toBe(leftovers!.cellsLeft);
    for (const speck of leftovers!.specksLying) {
      expect(speck.mass).toBe(eras.ERA_LEFTOVER_SPECK_MASS);
      expect(distanceBetween(speck, { x: 0, y: 0 })).toBeLessThanOrEqual(FOOTPRINT_RADIUS_WU);
    }
    expect(room.world.moveGraceEndsAtTick).not.toBeNull();
    expectReplayReproduces(room);
    expect(() => room.handle.setEra(GAME_ERA.dish)).toThrow(DebugRequestError);
  });

  it('C: no engulf of a player starts while the grace runs, a player predating; the first starts as it ends', async () => {
    const room = startEraRoom({ roundDurationSeconds: COLONIES_ON_ROUND_SECONDS, players: [ERA_PLAYER, PREDATOR] });
    await room.stepTo(JUMP_TICK);
    room.handle.setEra(GAME_ERA.pool);
    await room.stepTo(MOVE_TICK);
    const graceEndsAtTick = MOVE_TICK + secondsToTicks(eras.ERA_MOVE_GRACE_SECONDS);
    expect(room.world.moveGraceEndsAtTick).toBe(graceEndsAtTick);
    expect(await firstEngulfStartHeld(room, graceEndsAtTick)).toBe(graceEndsAtTick);
    expectReplayReproduces(room);
  });
});
