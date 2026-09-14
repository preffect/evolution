// What each viewer is sent (docs/architecture/wire-contract.md §4.1, #331): the room serialises once per broadcast
// and hands every connection, and every `game_state`, the module's projection for that player.
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE, SERVER_MESSAGE_TYPE, SNAPSHOT_EVERY_TICKS, type PlayerId } from '@evolution/shared';
import { GameRoom } from './game-room.js';
import {
  createManualRoomTiming,
  createSpyGameModule,
  createTestConnection,
  createTestRoomInitOptions,
  type SentLog,
} from '../testing/builders.js';

const VIEWERS = ['p1', 'p2'];

/** A spy module that marks every snapshot with the viewer it was projected for. */
function viewerMarkingModule() {
  const gameModule = createSpyGameModule();
  gameModule.snapshotForViewer = vi.fn((snapshot, viewerPlayerId) => ({ ...snapshot, viewer: viewerPlayerId }));
  return gameModule;
}

describe('game-room: what each viewer is sent', () => {
  it('serialises once per broadcast and sends each connection the snapshot projected for it', () => {
    const sent: SentLog = {};
    const gameModule = viewerMarkingModule();
    const room = new GameRoom(gameModule, createTestRoomInitOptions(VIEWERS), createManualRoomTiming());
    for (const viewer of VIEWERS) room.addPlayer(createTestConnection({ playerId: viewer, sent }));
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(gameModule.serializeRoomState).toHaveBeenCalledTimes(1);
    for (const viewer of VIEWERS) {
      expect(sent[viewer]).toMatchObject([{ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { viewer } }]);
    }
  });

  it('projects the game_state for the player it is addressed to', () => {
    const room = new GameRoom(viewerMarkingModule(), createTestRoomInitOptions(VIEWERS), createManualRoomTiming());
    expect(room.gameStateMessageFor('p2' as PlayerId)).toMatchObject({
      type: SERVER_MESSAGE_TYPE.gameState,
      snapshot: { viewer: 'p2' },
      balance: DEFAULT_BALANCE,
    });
  });
});
