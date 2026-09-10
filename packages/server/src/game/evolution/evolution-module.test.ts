// The module as wiring (docs/ARCHITECTURE.md §3, §3.2): inputs coalesce and stale ones are
// counted, a step advances the one world, the broadcast is a delta and the full state is full,
// joins and leaves reach the world and the replay, and a spawned bot drives its own player.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  createTestGameInput,
  createTestSessionConfig,
  playerId,
  type GameInput,
} from '@evolution/shared';
import { createEvolutionModule, type EvolutionModule } from './evolution-module.js';
import type { Replay } from './replay/replay-format.js';

const ALICE = playerId('alice');
const BOB = playerId('bob');
const BOT_SEED = 5;
const TICKS_WITH_BOT = 3;

function createModule(): EvolutionModule {
  return createEvolutionModule({
    creatorId: ALICE,
    playerIds: [ALICE],
    gameName: 'unit',
    config: createTestSessionConfig({ seed: 42 }),
    avatarAssignments: { [ALICE]: 2 },
    playerNames: { [ALICE]: 'Alice' },
  });
}

function pendingOf(module: EvolutionModule, id = ALICE): GameInput | null {
  return module.world.players.find((player) => player.playerId === id)?.pendingInput ?? null;
}

describe('createEvolutionModule', () => {
  it('builds the world from the config seed with the roster, named and avatared', () => {
    const module = createModule();
    expect(module.world.seed).toBe(42);
    expect(module.world.players.map((player) => [player.playerName, player.avatarIndex])).toEqual([['Alice', 2]]);
    expect(module.world.balance).toEqual(DEFAULT_BALANCE);
    expect(module.world.balance).not.toBe(DEFAULT_BALANCE);
  });

  it('coalesces inputs, drops a stale sequence and counts it, and ignores an unknown player', () => {
    const module = createModule();
    module.submitInput(ALICE, createTestGameInput({ sequence: 1, shouldSprint: true }));
    module.submitInput(ALICE, createTestGameInput({ sequence: 2, targetX: 50 }));
    expect(pendingOf(module)).toEqual(createTestGameInput({ sequence: 2, targetX: 50, shouldSprint: true }));
    module.submitInput(ALICE, createTestGameInput({ sequence: 2, targetX: 99 }));
    expect(pendingOf(module)?.targetX).toBe(50);
    expect(module.rejections.staleSequence).toBe(1);
    module.submitInput(BOB, createTestGameInput({ sequence: 1 }));
    expect(module.world.players).toHaveLength(1);
  });

  it('applies the pending input on the next step and echoes its sequence in the snapshot', () => {
    const module = createModule();
    module.submitInput(ALICE, createTestGameInput({ sequence: 4, targetX: 1000, targetY: 1000 }));
    module.reduceGameState();
    expect(module.world.tick).toBe(1);
    expect(pendingOf(module)).toBeNull();
    expect(module.serializeRoomState().appliedInputSequenceByPlayer[ALICE]).toBe(4);
  });

  it('broadcasts deltas after a full first snapshot and carries the effects since the last broadcast', () => {
    const module = createModule();
    const first = module.serializeRoomState();
    expect(first.food.spawned.length).toBe(module.world.food.length);
    module.reduceGameState();
    const second = module.serializeRoomState();
    expect(second.food.spawned.length).toBeLessThan(first.food.spawned.length);
    expect(second.tick).toBe(1);
    expect(module.serializeFullState().snapshot.food.spawned.length).toBe(module.world.food.length);
    expect(module.serializeFullState().balance).toBe(module.world.balance);
  });

  it('adds a late joiner to the world and the replay, and removes them again', () => {
    const module = createModule();
    module.addPlayer(BOB, 1, 'Bob');
    module.addPlayer(BOB, 1, 'Bob');
    expect(module.world.players.map((player) => player.playerId)).toEqual([ALICE, BOB]);
    expect(module.world.cells).toHaveLength(2);
    module.removePlayer(BOB);
    module.removePlayer(BOB);
    expect(module.world.players.map((player) => player.playerId)).toEqual([ALICE]);
    const recording = module.getDebugHandle().exportReplay() as Replay;
    expect(recording.membership.map((event) => event.kind)).toEqual(['join', 'leave']);
  });

  it('drives a spawned bot from the snapshot of the tick before, stamped with the step tick', () => {
    const module = createModule();
    const bot = module.getDebugHandle().spawnBot({ behavior: 'grazer', seed: BOT_SEED });
    expect(module.world.players.map((player) => player.playerId)).toEqual([ALICE, bot.playerId]);
    for (let tick = 0; tick < TICKS_WITH_BOT; tick += 1) {
      module.reduceGameState();
    }
    const botPlayer = module.world.players.find((player) => player.playerId === bot.playerId);
    expect(botPlayer?.appliedInputSequence).toBe(TICKS_WITH_BOT);
    expect(botPlayer?.lifeState).toBe(PLAYER_LIFE_STATE.alive);
    const recording = module.getDebugHandle().exportReplay() as Replay;
    expect(recording.inputs.map((entry) => entry.tick)).toEqual([1, 2, TICKS_WITH_BOT]);
    expect(module.getDebugHandle().removeBot(bot.playerId)).toEqual(bot);
    expect(module.world.players.map((player) => player.playerId)).toEqual([ALICE]);
  });

  it('refuses to remove a player that is not a bot, leaving them in the world', () => {
    const module = createModule();
    expect(() => module.getDebugHandle().removeBot(ALICE)).toThrow('is not a bot');
    expect(module.world.players).toHaveLength(1);
  });
});
