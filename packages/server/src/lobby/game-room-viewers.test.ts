// What each viewer is sent (docs/architecture/wire-contract.md §4.1, #331): the room serialises once per broadcast
// and hands every connection, and every `game_state`, that snapshot with the module's declared members for its player.
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

function ownProgressMember(viewerPlayerId: PlayerId) {
  return { ownProgress: createTestPlayerProgressView({ playerId: viewerPlayerId }) };
}

/** A spy module that declares `ownProgress` as its one viewer member, naming the viewer it was serialised for. */
function viewerStateModule() {
  const serialize = vi.fn(ownProgressMember);
  const serializeFull = vi.fn(ownProgressMember);
  const viewerState = { keys: ['ownProgress' as const], serialize, serializeFull };
  const gameModule = { ...createSpyGameModule(), viewerState };
  return { gameModule, serialize, serializeFull };
}

describe('game-room: what each viewer is sent', () => {
  it('serialises once per broadcast and builds each connection’s members against that one snapshot', () => {
    const sent: SentLog = {};
    const { gameModule, serialize, serializeFull } = viewerStateModule();
    const room = new GameRoom(gameModule, createTestRoomInitOptions(VIEWERS), createManualRoomTiming());
    for (const viewer of VIEWERS) room.addPlayer(createTestConnection({ playerId: viewer, sent }));
    room.start();
    room.step(SNAPSHOT_EVERY_TICKS);
    expect(gameModule.serializeRoomState).toHaveBeenCalledTimes(1);
    const broadcast = vi.mocked(gameModule.serializeRoomState).mock.results[0]!.value as unknown;
    expect(serialize).toHaveBeenCalledTimes(VIEWERS.length);
    expect(serializeFull).not.toHaveBeenCalled();
    for (const viewer of VIEWERS) {
      expect(serialize).toHaveBeenCalledWith(viewer, broadcast);
      expect(sent[viewer]).toMatchObject([
        { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { ownProgress: { playerId: viewer } } },
      ]);
    }
  });

  it('gives the game_state the full-state members of the player it is addressed to', () => {
    const { gameModule, serialize, serializeFull } = viewerStateModule();
    const room = new GameRoom(gameModule, createTestRoomInitOptions(VIEWERS), createManualRoomTiming());
    expect(room.gameStateMessageFor('p2' as PlayerId)).toMatchObject({
      type: SERVER_MESSAGE_TYPE.gameState,
      snapshot: { ownProgress: { playerId: 'p2' } },
      balance: DEFAULT_BALANCE,
    });
    expect(serializeFull).toHaveBeenCalledWith('p2', room.getFullState().snapshot);
    expect(serialize).not.toHaveBeenCalled();
  });
});
