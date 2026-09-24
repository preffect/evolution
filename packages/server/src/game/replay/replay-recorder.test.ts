import { describe, expect, it } from 'vitest';
import { REPLAY_FORMAT_VERSION, createTestGameInput, playerId } from '@evolution/shared';
import { DEBUG_PATCH_KIND } from '../debug/debug-operations.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { computeStateHash } from '../world/state-hash.js';
import { REPLAY_MEMBERSHIP_KIND, REPLAY_ORIGIN } from './replay-format.js';
import { ReplayRecorder } from './replay-recorder.js';

/** A real balance path, named through a constant because a patch is keyed by constant names. */
const DISH_RADIUS_LEAF = 'DISH_RADIUS';
const RECORDED_TICKS = 5;

/** Records one input a tick for `ticks` ticks, as the module does right before each step. */
function recordTicks(ticks: number) {
  const world = createTestWorld();
  const recorder = new ReplayRecorder(world);
  for (let tick = 0; tick < ticks; tick += 1) {
    world.players[0]!.pendingInput = createTestGameInput({ sequence: tick + 1 });
    recorder.recordPendingInputs(world);
    world.players[0]!.pendingInput = null; // the step applied it
    world.tick += 1;
  }
  return { world, recorder };
}

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
    recorder.recordLeave(world, world.players[0]!);
    const patch = { kind: DEBUG_PATCH_KIND.setBalance, patch: { world: { [DISH_RADIUS_LEAF]: 100 } } } as const;
    recorder.recordDebugPatch(world, patch);
    const replay = recorder.export(world);
    expect(replay.inputs).toEqual([{ tick: 4, playerId: 'p1', input }]);
    expect(replay.membership).toEqual([
      { tick: 4, kind: REPLAY_MEMBERSHIP_KIND.join, playerId: 'p2', playerName: 'Bob', avatarIndex: 1 },
      { tick: 4, kind: REPLAY_MEMBERSHIP_KIND.leave, playerId: 'p1', playerName: 'Alice', avatarIndex: 0 },
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
    world.players[0]!.pendingInput = null; // the step applied it
    world.tick = 10;
    const hashAtClose = computeStateHash(world);
    world.seed = 43;
    recorder.startNewRound(world, REPLAY_ORIGIN.reseed, hashAtClose);
    expect(recorder.completedRounds).toHaveLength(1);
    expect(recorder.completedRounds[0]!.finalTick).toBe(10);
    expect(recorder.completedRounds[0]!.finalHash).toBe(hashAtClose);
    expect(recorder.completedRounds[0]!.inputs).toHaveLength(1);
    const next = recorder.export(world);
    expect(next.seed).toBe(43);
    expect(next.startTick).toBe(10);
    expect(next.startedBy).toBe(REPLAY_ORIGIN.reseed);
    expect(next.nextEntityNumber).toBe(world.roundFirstEntityNumber);
    expect(next.inputs).toEqual([]);
    expect(recorder.completedRounds[0]!.startedBy).toBe(REPLAY_ORIGIN.worldBuild);
  });

  it('closes with the world hash now when no closing hash is given', () => {
    const world = createTestWorld();
    const recorder = new ReplayRecorder(world);
    recorder.startNewRound(world, REPLAY_ORIGIN.rematch);
    expect(recorder.completedRounds[0]!.finalHash).toBe(computeStateHash(world));
  });

  it('exports copies: later recording does not change an earlier export', () => {
    const world = createTestWorld();
    const recorder = new ReplayRecorder(world);
    const earlier = recorder.export(world);
    recorder.recordJoin(world, { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 });
    expect(earlier.membership).toEqual([]);
  });

  it('records a fact once when an export between ticks is followed by the step, the later input replacing it', () => {
    const { world, recorder } = recordTicks(RECORDED_TICKS);
    const player = world.players[0]!;
    player.pendingInput = createTestGameInput({ sequence: 10 });
    recorder.export(world);
    player.pendingInput = createTestGameInput({ sequence: 11 });
    recorder.recordPendingInputs(world);
    const inputs = recorder.export(world).inputs;
    expect(inputs.map((entry) => entry.tick)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(inputs.at(-1)?.input.sequence).toBe(11);
  });

  it('replaces every entry an export stamped for the coming tick, and never changes a replay already exported', () => {
    const world = createTestWorld({
      players: [
        { playerId: playerId('p1'), playerName: 'Ada', avatarIndex: 0 },
        { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 },
      ],
    });
    const recorder = new ReplayRecorder(world);
    for (const player of world.players) {
      player.pendingInput = createTestGameInput({ sequence: 1 });
    }
    const exported = recorder.export(world);
    const exportedCopy = structuredClone(exported);
    for (const player of world.players) {
      player.pendingInput = createTestGameInput({ sequence: 2 });
    }
    recorder.recordPendingInputs(world);
    const inputs = recorder.export(world).inputs;
    expect(inputs.map((entry) => entry.input.sequence)).toEqual([2, 2]);
    expect(exported).toEqual(exportedCopy);
  });

  it('never walks the whole log to record a tick: only its tail is read (#181, a cost growing with the room age)', () => {
    const { world, recorder } = recordTicks(RECORDED_TICKS);
    const earlierEntries = recorder.export(world).inputs;
    let earlierTickReads = 0;
    for (const entry of earlierEntries.slice(0, -1)) {
      const { tick } = entry;
      Object.defineProperty(entry, 'tick', {
        get: () => {
          earlierTickReads += 1;
          return tick;
        },
      });
    }
    world.players[0]!.pendingInput = createTestGameInput({ sequence: RECORDED_TICKS + 1 });
    recorder.recordPendingInputs(world);
    expect(earlierTickReads).toBe(0);
    expect(recorder.export(world).inputs).toHaveLength(RECORDED_TICKS + 1);
  });
});
