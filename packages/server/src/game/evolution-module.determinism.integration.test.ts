// docs/DETERMINISM.md §7 and #111's last row: two rooms on the Evolution module, same seed and
// the same scripted inputs, driven through the real `GameRoom` loop under a `ManualClock` and a
// `ManualTicker`, hash equal at every 600-tick checkpoint and at 10 000 ticks; a different seed
// differs. The hash is `computeStateHash` over the world through the debug handle
// (`debug_get_state_hash`'s path). Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import {
  MAX_TICKS_PER_ADVANCE,
  TICK_INTERVAL_MS,
  createTestGameInput,
  createTestSessionConfig,
  playerId,
  type PlayerId,
  type StateHash,
} from '@evolution/shared';
import { GameRoom } from '../lobby/game-room.js';
import { createManualRoomTiming, createTestRoomInitOptions } from '../testing/builders.js';
import { createEvolutionModule } from './evolution-module.js';

const TOTAL_TICKS = 10_000;
const CHECKPOINT_EVERY_TICKS = 600;
const SEED = 42;
const OTHER_SEED = 43;
const ALICE = playerId('alice');
const BOB = playerId('bob');
/** Every player steers to a point that turns with the tick, sprinting on every 500th tick. */
const SPRINT_EVERY_TICKS = 500;
const TARGET_RADIUS_WU = 1000;
const TARGET_TURN_TICKS = 900;

function scriptedInput(tick: number, playerIndex: number) {
  const angle = ((tick + playerIndex * TARGET_TURN_TICKS) / TARGET_TURN_TICKS) * Math.PI;
  return createTestGameInput({
    sequence: tick,
    targetX: Math.cos(angle) * TARGET_RADIUS_WU,
    targetY: Math.sin(angle) * TARGET_RADIUS_WU,
    shouldSprint: tick % SPRINT_EVERY_TICKS === 0,
  });
}

/** A room on the real module under manual timing, stepped in ticker fires of at most `MAX_TICKS_PER_ADVANCE`. */
function startRoom(seed: number) {
  const options = createTestRoomInitOptions([ALICE, BOB], { config: createTestSessionConfig({ seed }) });
  const module = createEvolutionModule(options);
  const timing = createManualRoomTiming();
  const room = new GameRoom(module, options, timing);
  room.start();
  const hash = (): StateHash => room.getDebugHandle()!.computeStateHash!();
  const players: readonly PlayerId[] = [ALICE, BOB];
  /** Feeds every player's input for the coming tick, advances the clock one interval and fires the ticker. */
  const stepOne = () => {
    const nextTick = room.getTickCount() + 1;
    players.forEach((player, index) => room.submitInput(player, scriptedInput(nextTick, index)));
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    timing.ticker.fire();
  };
  return { room, hash, stepOne, stop: () => room.stop() };
}

/** Runs `ticks` ticks and returns the hash at every checkpoint (tick 0 included) and the final one. */
function hashesOver(seed: number, ticks: number): StateHash[] {
  const { hash, stepOne, stop } = startRoom(seed);
  const hashes = [hash()];
  for (let tick = 1; tick <= ticks; tick += 1) {
    stepOne();
    if (tick % CHECKPOINT_EVERY_TICKS === 0 || tick === ticks) hashes.push(hash());
  }
  stop();
  return hashes;
}

describe('Evolution module determinism through the room loop', () => {
  it('two rooms with one seed and one script hash equal at every 600 ticks and at 10 000', () => {
    const first = hashesOver(SEED, TOTAL_TICKS);
    const second = hashesOver(SEED, TOTAL_TICKS);
    expect(first).toHaveLength(Math.floor(TOTAL_TICKS / CHECKPOINT_EVERY_TICKS) + 2);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it('a different seed diverges from the first checkpoint on', () => {
    const first = hashesOver(SEED, CHECKPOINT_EVERY_TICKS);
    const other = hashesOver(OTHER_SEED, CHECKPOINT_EVERY_TICKS);
    expect(other[0]).not.toBe(first[0]);
    expect(other[1]).not.toBe(first[1]);
  });

  it('a ticker fire that owes several ticks steps them all, up to the cap', () => {
    const options = createTestRoomInitOptions([ALICE], { config: createTestSessionConfig({ seed: SEED }) });
    const timing = createManualRoomTiming();
    const room = new GameRoom(createEvolutionModule(options), options, timing);
    room.start();
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * MAX_TICKS_PER_ADVANCE);
    timing.ticker.fire();
    expect(room.getTickCount()).toBe(MAX_TICKS_PER_ADVANCE);
    room.stop();
  });
});
