import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  SERVER_MESSAGE_TYPE,
  createTestPlayerProgressView,
  createTestSnapshot,
  playerId,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
import type { RoomGameModule, ViewerStateSerializer } from '../game/game-module.js';
import { createSpyGameModule, createTestConnection, type SentLog } from '../testing/builders.js';
import { sendSnapshotToViewers, snapshotForViewer, viewerMembersOf } from './viewer-snapshots.js';

const ALICE = playerId('alice');
const BOB = playerId('bob');
const VIEWER_KEYS = ['ownProgress', 'appliedInputSequenceByPlayer'] as const;
type ViewerKey = (typeof VIEWER_KEYS)[number];
/** The sequence a `game_state`'s members carry, so a test can tell them from a broadcast's. */
const FULL_STATE_SEQUENCE = -1;

/** A viewer's members, naming the viewer and the snapshot they were built against. */
function membersOf(viewerPlayerId: PlayerId, sequence: number): Pick<GameSnapshot, ViewerKey> {
  return {
    ownProgress: createTestPlayerProgressView({ playerId: viewerPlayerId }),
    appliedInputSequenceByPlayer: { [viewerPlayerId]: sequence },
  };
}

const VIEWER_STATE: ViewerStateSerializer<GameSnapshot, ViewerKey> = {
  keys: VIEWER_KEYS,
  serialize: (viewerPlayerId, snapshot) => membersOf(viewerPlayerId, snapshot.tick),
  serializeFull: (viewerPlayerId) => membersOf(viewerPlayerId, FULL_STATE_SEQUENCE),
};

function viewerStateModule(): RoomGameModule {
  return { ...createSpyGameModule(), viewerState: VIEWER_STATE };
}

function messageFor(snapshot: GameSnapshot, members: Partial<GameSnapshot>) {
  return { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { ...snapshot, ...members } };
}

describe('viewerMembersOf', () => {
  it('answers every declared member in declared order, a null one included', () => {
    const members = viewerMembersOf(VIEWER_KEYS, { appliedInputSequenceByPlayer: {}, ownProgress: null });
    expect(members).toEqual({ ownProgress: null, appliedInputSequenceByPlayer: {} });
    expect(Object.keys(members)).toEqual([...VIEWER_KEYS]);
  });

  it('throws for a declared member the module left out', () => {
    expect(() => viewerMembersOf(VIEWER_KEYS, { ownProgress: null })).toThrow(/appliedInputSequenceByPlayer/);
  });
});

describe('snapshotForViewer', () => {
  it('is the snapshot itself for a module without viewer state', () => {
    const snapshot = createTestSnapshot();
    expect(snapshotForViewer(createSpyGameModule(), snapshot, ALICE)).toBe(snapshot);
  });

  it('carries the viewer’s full-state members and leaves the snapshot alone', () => {
    const snapshot = createTestSnapshot({ ownProgress: createTestPlayerProgressView({ playerName: 'stale' }) });
    const viewed = snapshotForViewer(viewerStateModule(), snapshot, BOB);
    expect(viewed).toEqual({ ...snapshot, ...membersOf(BOB, FULL_STATE_SEQUENCE) });
    expect(viewed.players).toBe(snapshot.players);
    expect(snapshot.ownProgress?.playerName).toBe('stale');
  });
});

describe('sendSnapshotToViewers', () => {
  it('sends every connection the one snapshot, and its bytes, when the module has no viewer state', () => {
    const sent: SentLog = {};
    const targets = [ALICE, BOB].map((id) => createTestConnection({ playerId: id, sent }));
    const snapshot = createTestSnapshot({ tick: 3 });
    const message = { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot };
    expect(sendSnapshotToViewers(createSpyGameModule(), targets, snapshot)).toBe(JSON.stringify(message).length);
    expect(sent[ALICE]).toEqual([message]);
    expect(sent[BOB]).toEqual([message]);
  });

  it('sends each connection its members built against this broadcast and answers the mean bytes per client', () => {
    const sent: SentLog = {};
    const targets = [ALICE, BOB].map((id) => createTestConnection({ playerId: id, sent }));
    const snapshot = createTestSnapshot({ tick: 9 });
    const bytes = sendSnapshotToViewers(viewerStateModule(), targets, snapshot);
    let expectedTotal = 0;
    for (const viewer of [ALICE, BOB]) {
      const expected = messageFor(snapshot, membersOf(viewer, snapshot.tick));
      expect(sent[viewer]).toEqual([expected]);
      expectedTotal += JSON.stringify(expected).length;
    }
    expect(bytes).toBe(Math.round(expectedTotal / targets.length));
  });

  it('counts no bytes for a closed socket, and none at all with no one to send to', () => {
    const sent: SentLog = {};
    const open = createTestConnection({ playerId: ALICE, sent });
    const closed = createTestConnection({ playerId: BOB, readyState: WebSocket.CLOSED, sent });
    const snapshot = createTestSnapshot({ tick: 3 });
    const openBytes = JSON.stringify(messageFor(snapshot, membersOf(ALICE, snapshot.tick))).length;
    expect(sendSnapshotToViewers(viewerStateModule(), [open, closed], snapshot)).toBe(Math.round(openBytes / 2));
    expect(sendSnapshotToViewers(viewerStateModule(), [], snapshot)).toBe(0);
  });
});
