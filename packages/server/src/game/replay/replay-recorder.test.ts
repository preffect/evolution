import { describe, expect, it } from 'vitest';
import { REPLAY_FORMAT_VERSION, createTestGameInput, playerId } from '@evolution/shared';
import { DEBUG_PATCH_KIND } from '../debug/debug-operations.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { computeStateHash } from '../world/state-hash.js';
import { REPLAY_MEMBERSHIP_KIND } from './replay-format.js';
import { ReplayRecorder } from './replay-recorder.js';

/** A real balance path, named through a constant because a patch is keyed by constant names. */
const DISH_RADIUS_LEAF = 'DISH_RADIUS';

describe('ReplayRecorder', () => {
  it('starts from the world as it is: seed, start tick, roster, a balance copy', () => {
    const world = createTestWorld();
    world.tick = 5;
    const recorder = new ReplayRecorder(world);
    const replay = recorder.export(world);
    expect(replay.version).toBe(REPLAY_FORMAT_VERSION);
    expect(replay.seed).toBe(world.seed);
    expect(replay.startTick).toBe(5);
    expect(replay.roster).toEqual([{ playerId: 'p1', playerName: 'Alice', avatarIndex: 0 }]);
    expect(replay.balance).toEqual(world.balance);
    expect(replay.balance).not.toBe(world.balance);
    expect(replay.finalTick).toBe(5);
    expect(replay.finalHash).toBe(computeStateHash(world));
  });

  it('stamps pending inputs, joins, leaves and debug patches with the next tick', () => {
    const world = createTestWorld();
    const recorder = new ReplayRecorder(world);
    world.tick = 3;
    const input = createTestGameInput({ sequence: 2 });
    world.players[0]!.pendingInput = input;
    recorder.recordPendingInputs(world);
    recorder.recordJoin(world, { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 });
    recorder.recordLeave(world, playerId('p1'));
    recorder.recordLeave(world, playerId('ghost'));
    const patch = { kind: DEBUG_PATCH_KIND.setBalance, patch: { world: { [DISH_RADIUS_LEAF]: 100 } } } as const;
    recorder.recordDebugPatch(world, patch);
    const replay = recorder.export(world);
    expect(replay.inputs).toEqual([{ tick: 4, playerId: 'p1', input }]);
    expect(replay.membership).toEqual([
      { tick: 4, kind: REPLAY_MEMBERSHIP_KIND.join, playerId: 'p2', playerName: 'Bob', avatarIndex: 1 },
      { tick: 4, kind: REPLAY_MEMBERSHIP_KIND.leave, playerId: 'p1', playerName: 'Alice', avatarIndex: 0 },
      { tick: 4, kind: REPLAY_MEMBERSHIP_KIND.leave, playerId: 'ghost', playerName: 'ghost', avatarIndex: 0 },
    ]);
    expect(replay.debugPatches).toEqual([{ tick: 4, patch }]);
  });

  it('does not record a player with no pending input', () => {
    const world = createTestWorld();
    const recorder = new ReplayRecorder(world);
    recorder.recordPendingInputs(world);
    expect(recorder.export(world).inputs).toEqual([]);
  });

  it('closes the recording on a new round and starts a fresh one from the world', () => {
    const world = createTestWorld();
    const recorder = new ReplayRecorder(world);
    world.players[0]!.pendingInput = createTestGameInput();
    recorder.recordPendingInputs(world);
    world.tick = 10;
    const hashAtClose = computeStateHash(world);
    world.seed = 43;
    recorder.startNewRound(world, hashAtClose);
    expect(recorder.completedRounds).toHaveLength(1);
    expect(recorder.completedRounds[0]!.finalTick).toBe(10);
    expect(recorder.completedRounds[0]!.finalHash).toBe(hashAtClose);
    expect(recorder.completedRounds[0]!.inputs).toHaveLength(1);
    const next = recorder.export(world);
    expect(next.seed).toBe(43);
    expect(next.startTick).toBe(10);
    expect(next.inputs).toEqual([]);
  });

  it('closes with the world hash now when no closing hash is given', () => {
    const world = createTestWorld();
    const recorder = new ReplayRecorder(world);
    recorder.startNewRound(world);
    expect(recorder.completedRounds[0]!.finalHash).toBe(computeStateHash(world));
  });

  it('exports copies: later recording does not change an earlier export', () => {
    const world = createTestWorld();
    const recorder = new ReplayRecorder(world);
    const earlier = recorder.export(world);
    recorder.recordJoin(world, { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 });
    expect(earlier.membership).toEqual([]);
  });
});
