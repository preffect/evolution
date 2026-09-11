// docs/DETERMINISM.md §6, §7: a room on the Evolution module records joins, inputs and debug
// patches as it runs; `debug_export_replay`'s export replayed from scratch reproduces the room's
// `finalHash`, and `debug_set_seed` closes that round (still replayable) and opens a new recording
// from the new seed over the running world. Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import {
  ENTITY_KIND,
  TICK_INTERVAL_MS,
  createTestGameInput,
  createTestSessionConfig,
  playerId,
} from '@evolution/shared';
import { GameRoom } from '../../lobby/game-room.js';
import { createManualRoomTiming, createTestRoomInitOptions } from '../../testing/builders.js';
import { createEvolutionModule, type EvolutionModule } from '../evolution-module.js';
import type { Replay } from './replay-format.js';
import { replay } from './replay-runner.js';

const SEED = 42;
const RESEED = 99;
const TICKS_BEFORE_RESEED = 120;
const TICKS_AFTER_RESEED = 90;
const JOIN_TICK = 30;
const SPAWN_TICK = 60;
const GRANT_TICK = 75;
const INPUT_EVERY_TICKS = 7;
const ALICE = playerId('alice');
const BOB = playerId('bob');
const CID = playerId('cid');

function roomUnderTest() {
  const options = createTestRoomInitOptions([ALICE, BOB], { config: createTestSessionConfig({ seed: SEED }) });
  const module: EvolutionModule = createEvolutionModule(options);
  const timing = createManualRoomTiming();
  const room = new GameRoom(module, options, timing);
  room.start();
  const handle = module.getDebugHandle();
  const step = (tick: number) => {
    if (tick === JOIN_TICK) module.addPlayer(CID, 2, 'Cid');
    if (tick === SPAWN_TICK) handle.spawn({ kind: ENTITY_KIND.foodMote, x: 100, y: 100, params: { kind: 'algae' } });
    if (tick === GRANT_TICK) handle.grantDna(ALICE, { dna: 30, tags: ['predatory'] });
    if (tick % INPUT_EVERY_TICKS === 0) {
      room.submitInput(ALICE, createTestGameInput({ sequence: tick, targetX: 1500, targetY: tick }));
    }
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    timing.ticker.fire();
  };
  return { module, room, handle, step, stop: () => room.stop() };
}

describe('replaying what a room recorded', () => {
  it('reproduces the final hash of a run with a late join, inputs and debug patches', () => {
    const { handle, step, stop } = roomUnderTest();
    for (let tick = 1; tick <= TICKS_BEFORE_RESEED; tick += 1) step(tick);
    const recording = handle.exportReplay() as Replay;
    stop();
    expect(recording.finalTick).toBe(TICKS_BEFORE_RESEED);
    expect(recording.membership.map((event) => [event.kind, event.tick])).toEqual([['join', JOIN_TICK]]);
    expect(recording.debugPatches.map((patch) => patch.tick)).toEqual([SPAWN_TICK, GRANT_TICK]);
    expect(recording.inputs.length).toBeGreaterThan(0);
    const replayed = replay(recording);
    expect(replayed.hash).toBe(recording.finalHash);
    expect(replayed.world.players.map((player) => player.playerId)).toEqual([ALICE, BOB, CID]);
  });

  it('a reseed closes the round at the tick before it (replayable) and starts a new recording from the new seed', () => {
    const { module, handle, step, stop } = roomUnderTest();
    for (let tick = 1; tick <= TICKS_BEFORE_RESEED; tick += 1) step(tick);
    const closed = handle.exportReplay() as Replay;
    handle.reseed(RESEED);
    for (let tick = TICKS_BEFORE_RESEED + 1; tick <= TICKS_BEFORE_RESEED + TICKS_AFTER_RESEED; tick += 1) step(tick);
    const current = handle.exportReplay() as Replay;
    stop();
    expect(replay(closed).hash).toBe(closed.finalHash);
    expect(module.world.seed).toBe(RESEED);
    expect(current.seed).toBe(RESEED);
    expect(current.startTick).toBe(TICKS_BEFORE_RESEED);
    expect(current.membership).toEqual([]);
    expect(current.finalTick).toBe(TICKS_BEFORE_RESEED + TICKS_AFTER_RESEED);
    expect(current.finalHash).not.toBe(closed.finalHash);
  });
});
