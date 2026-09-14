// What each viewer is sent (docs/architecture/wire-contract.md §4.1, #331): the room serialises once per broadcast
// and hands every connection, and every `game_state`, that snapshot with the module's own progress for its player.
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_EVERY_TICKS,
  createTestPlayerProgressView,
  type PlayerId,
} from '@evolution/shared';
import { GameRoom } from './game-room.js';
import {
  createManualRoomTiming,
  createSpyGameModule,
  createTestConnection,
  createTestRoomInitOptions,
  type SentLog,
} from '../testing/builders.js';

const VIEWERS = ['p1', 'p2'];

/** A spy module whose own progress for a viewer names that viewer. */
function ownProgressModule() {
  const gameModule = createSpyGameModule();
  gameModule.serializeOwnProgress = vi.fn((viewerPlayerId: PlayerId) =>
    createTestPlayerProgressView({ playerId: viewerPlayerId }),
  );
  return gameModule;
}

describe('game-room: what each viewer is sent', () => {
  it('serialises once per broadcast and sends each connection the snapshot with its own progress', () => {
    const sent: SentLog = {};
    const gameModule = ownProgressModule();
    const room = new GameRoom(gameModule, createTestRoomInitOptions(VIEWERS), createManualRoomTiming());
    for (const viewer of VIEWERS) room.addPlayer(createTestConnection({ playerId: viewer, sent }));
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(gameModule.serializeRoomState).toHaveBeenCalledTimes(1);
    expect(gameModule.serializeOwnProgress).toHaveBeenCalledTimes(VIEWERS.length);
    for (const viewer of VIEWERS) {
      expect(sent[viewer]).toMatchObject([
        { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { ownProgress: { playerId: viewer } } },
      ]);
    }
  });

  it('gives the game_state the own progress of the player it is addressed to', () => {
    const room = new GameRoom(ownProgressModule(), createTestRoomInitOptions(VIEWERS), createManualRoomTiming());
    expect(room.gameStateMessageFor('p2' as PlayerId)).toMatchObject({
      type: SERVER_MESSAGE_TYPE.gameState,
      snapshot: { ownProgress: { playerId: 'p2' } },
      balance: DEFAULT_BALANCE,
    });
  });
});
