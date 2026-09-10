import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import { ScenarioSetupError } from './errors.js';
import { echoAdapter, echoedInput, hashEchoSnapshot, type EchoSnapshot } from './echo-adapter.js';

const FIRST = playerId('player_0');
const SECOND = playerId('player_1');
const OPTIONS = {
  creatorId: FIRST,
  playerIds: [FIRST, SECOND],
  gameName: 'echo',
  config: { maxPlayers: 8 },
  avatarAssignments: { [FIRST]: 0, [SECOND]: 1 },
  playerNames: { [FIRST]: 'Player 0', [SECOND]: 'Player 1' },
  seed: 42,
};

describe('echoAdapter', () => {
  it('builds the echo module with the roster and reads its snapshot', () => {
    const module = echoAdapter.createModule(OPTIONS);
    expect(echoAdapter.readSnapshot(module)).toEqual({ players: { [FIRST]: null, [SECOND]: null } });
  });

  it('stamps the command with its sequence and echoes it back', () => {
    const module = echoAdapter.createModule(OPTIONS);
    const input = echoAdapter.toInput({ targetX: 1, targetY: 2 }, 7);
    module.submitInput(OPTIONS.creatorId, input);
    expect(echoedInput(echoAdapter.readSnapshot(module), OPTIONS.creatorId)).toEqual({
      targetX: 1,
      targetY: 2,
      sequence: 7,
    });
    expect(echoedInput(echoAdapter.readSnapshot(module), playerId('player_9'))).toBeNull();
  });

  it('hashes the snapshot text: equal snapshots agree, a changed input differs', () => {
    const first = echoAdapter.createModule(OPTIONS);
    const second = echoAdapter.createModule(OPTIONS);
    expect(echoAdapter.hashState(first)).toBe(echoAdapter.hashState(second));
    second.submitInput(OPTIONS.creatorId, echoAdapter.toInput({ targetX: 1 }, 1));
    expect(echoAdapter.hashState(first)).not.toBe(echoAdapter.hashState(second));
    const snapshot: EchoSnapshot = { players: { [FIRST]: null } };
    expect(hashEchoSnapshot(snapshot)).toHaveLength(16);
  });

  it('has no cells to locate and no world to place fixtures in', () => {
    const module = echoAdapter.createModule(OPTIONS);
    expect(echoAdapter.locateCell(echoAdapter.readSnapshot(module), OPTIONS.creatorId)).toBeUndefined();
    expect(() => echoAdapter.applyFixture(module, undefined as never)).toThrow(ScenarioSetupError);
  });
});
