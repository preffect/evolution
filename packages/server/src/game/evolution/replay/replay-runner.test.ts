// docs/DETERMINISM.md §6, §7: recording a run then replaying it reproduces `finalHash`; a reseed
// starts a new recording that also reproduces.
import { describe, expect, it } from 'vitest';
import { ENTITY_KIND, createTestGameInput, createTestSessionConfig, playerId } from '@evolution/shared';
import { createEvolutionModule, type EvolutionModule } from '../evolution-module.js';
import type { Replay } from './replay-format.js';
import { replay } from './replay-runner.js';

const ROOM_TICKS = 40;
const JOIN_TICK = 10;
const SPAWN_TICK = 20;
const INPUT_TICKS = [3, 7, 25];

function createModule(): EvolutionModule {
  return createEvolutionModule({
    creatorId: playerId('p1'),
    playerIds: [playerId('p1'), playerId('p2')],
    gameName: 'replay',
    config: createTestSessionConfig({ seed: 42 }),
    avatarAssignments: { p1: 0, p2: 1 },
    playerNames: { p1: 'Alice', p2: 'Bob' },
  });
}

/** Drives a module through joins, inputs, a debug spawn and a late leave; returns the export. */
function drive(module: EvolutionModule, ticks: number, onTick?: (tick: number) => void): Replay {
  for (let tick = 1; tick <= ticks; tick += 1) {
    if (tick === JOIN_TICK) module.addPlayer(playerId('p3'), 2, 'Cid');
    if (INPUT_TICKS.includes(tick)) {
      module.submitInput(playerId('p1'), createTestGameInput({ sequence: tick, targetX: 1500 + tick, targetY: 0 }));
      module.submitInput(
        playerId('p2'),
        createTestGameInput({ sequence: tick, targetX: 0, targetY: 1500, shouldSprint: true }),
      );
    }
    if (tick === SPAWN_TICK) {
      module.getDebugHandle().spawn({ kind: ENTITY_KIND.foodMote, x: 100, y: 100, params: { kind: 'algae' } });
      module.getDebugHandle().grantDna(playerId('p1'), { dna: 12, tags: ['motile'] });
    }
    if (tick === ticks - 1) module.removePlayer(playerId('p2'));
    onTick?.(tick);
    module.reduceGameState();
  }
  return module.getDebugHandle().exportReplay() as Replay;
}

describe('replay', () => {
  it('reproduces the final hash of a recorded run with joins, leaves, inputs and debug patches', () => {
    const module = createModule();
    const recording = drive(module, ROOM_TICKS);
    expect(recording.finalTick).toBe(ROOM_TICKS);
    expect(recording.inputs.length).toBeGreaterThan(0);
    expect(recording.membership).toHaveLength(2);
    expect(recording.debugPatches).toHaveLength(2);
    const result = replay(recording);
    expect(result.hash).toBe(recording.finalHash);
    expect(result.world.tick).toBe(ROOM_TICKS);
  });

  it('differs when the recorded inputs are altered, so the hash is not vacuous', () => {
    const module = createModule();
    const recording = drive(module, ROOM_TICKS);
    const altered: Replay = {
      ...recording,
      inputs: recording.inputs.map((entry) => ({
        ...entry,
        input: { ...entry.input, targetY: entry.input.targetY + 50 },
      })),
    };
    expect(replay(altered).hash).not.toBe(recording.finalHash);
  });

  it('closes the recording at the hash before a reseed and starts the next one from the new seed', () => {
    const module = createModule();
    const beforeReseed = drive(module, ROOM_TICKS);
    const handle = module.getDebugHandle();
    handle.reseed(7);
    for (let tick = 0; tick < 12; tick += 1) {
      module.reduceGameState();
    }
    const closed = replay(beforeReseed);
    expect(closed.hash).toBe(beforeReseed.finalHash);
    const recording = handle.exportReplay() as Replay;
    expect(recording.seed).toBe(7);
    expect(recording.startTick).toBe(ROOM_TICKS);
    expect(recording.finalTick).toBe(ROOM_TICKS + 12);
    expect(recording.inputs).toEqual([]);
    // A reseed keeps the running world and rebuilds only the streams, so the recording after it
    // is not reproducible from seed + roster alone; the closed round is (docs/DETERMINISM.md §6).
    expect(replay(recording).hash).not.toBe(recording.finalHash);
  });

  it('ignores a recorded input for a player who is not in the world and a stale sequence', () => {
    const module = createModule();
    const recording = drive(module, 5);
    const padded: Replay = {
      ...recording,
      inputs: [
        ...recording.inputs,
        { tick: 2, playerId: playerId('nobody'), input: createTestGameInput() },
        { tick: 4, playerId: playerId('p1'), input: createTestGameInput({ sequence: 0 }) },
      ],
    };
    expect(replay(padded).hash).toBe(recording.finalHash);
  });
});
