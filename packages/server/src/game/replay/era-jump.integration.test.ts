// docs/game-design/phases.md §14.15 PH19 (§14.2.4): `debug_set_era` at tick 600 moves `roundStartTick` back so tick
// 601 is the era's first, never the tick counter; the step runs every crossed move in era order (a jump to the
// colonies runs the pool's move first, on the same tick); the jump is recorded, so `debug_export_replay` reproduces
// the final state hash across the move; the hash covers the pool's state; and no jump goes back. The cameras across the
// move are ticket #868's wire part, the leftover specks ticket #939's. Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GAME_ERA,
  createTestCopepodLane,
  createTestSurge,
  distanceBetween,
  type GameEra,
} from '@evolution/shared';
import { ERA_PLAYER, eraMovesIn, startEraRoom } from '../../testing/era-room.js';
import { DebugRequestError } from '../debug/debug-request-error.js';
import { computeStateHash } from '../world/state-hash.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { Replay } from './replay-format.js';
import { replay } from './replay-runner.js';

const { eras, pool, world: dish } = DEFAULT_BALANCE;
const COLONIES_ON_ROUND_SECONDS = 1500;
/** PH19's ticks: the jump at 600, the era's first tick 601, the run to 1 200, and the round start the jump leaves. */
const JUMP_TICK = 600;
const MOVE_TICK = JUMP_TICK + 1;
const END_TICK = 1200;
const PH19_ROUND_START_TICK = -35_399;
/** The footprint: the dish's radius over the scale step (300 wu). */
const FOOTPRINT_RADIUS_WU = dish.DISH_RADIUS / eras.ERA_SCALE_STEP;

/** A fresh PH19 room jumped to `era` at tick 600, its player's cell as it stood on the move tick, run to 1 200. */
async function jumpAndRun(era: GameEra) {
  const room = startEraRoom({ roundDurationSeconds: COLONIES_ON_ROUND_SECONDS });
  await room.stepTo(JUMP_TICK);
  const jump = room.handle.setEra(era);
  let landing: { x: number; y: number; mass: number } | undefined;
  await room.stepTo(END_TICK, (world) => {
    const cell = findCellOfPlayer(world, ERA_PLAYER);
    if (world.tick === MOVE_TICK && cell !== undefined) landing = { x: cell.x, y: cell.y, mass: cell.mass };
  });
  return { room, jump, landing };
}

function expectReplayReproduces(room: Awaited<ReturnType<typeof jumpAndRun>>['room']): void {
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
    const { room, landing } = await jumpAndRun(GAME_ERA.colonies);
    expect(eraMovesIn(room.effects)).toEqual([
      [MOVE_TICK, GAME_ERA.pool],
      [MOVE_TICK, GAME_ERA.colonies],
    ]);
    expect(room.world.eraMovedInto).toBe(GAME_ERA.colonies);
    expect(distanceBetween(landing!, { x: 0, y: 0 })).toBeLessThanOrEqual(FOOTPRINT_RADIUS_WU);
    expect(landing!.mass).toBeLessThan(pool.POOL_ARRIVAL_MASS);
    expect(landing!.mass).toBeGreaterThan(pool.POOL_ARRIVAL_MASS - 1);
    expect(room.world.moveGraceEndsAtTick).not.toBeNull();
    expectReplayReproduces(room);
    expect(() => room.handle.setEra(GAME_ERA.dish)).toThrow(DebugRequestError);
  });
});
