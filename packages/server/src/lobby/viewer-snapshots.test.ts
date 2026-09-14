import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  SERVER_MESSAGE_TYPE,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  playerId,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
import type { GameModule, ViewerStateSerializer } from '../game/game-module.js';
import { createSpyGameModule, createTestConnection, type SentLog } from '../testing/builders.js';
import {
  closeSnapshotFrame,
  openSnapshotFrame,
  sendSnapshotToViewers,
  snapshotForViewer,
  viewerMembersOf,
} from './viewer-snapshots.js';

const QUOTED_ID = playerId('quoted');
const SLASHED_ID = playerId('slashed');
const GONE_ID = playerId('gone');
const QUOTED_NAME = 'Say "hi" }}';
const SLASHED_NAME = 'back\\slash \\" {,';
/** Two members, so the splice is exercised past one; the lobby names neither. */
const VIEWER_KEYS = ['ownProgress', 'appliedInputSequenceByPlayer'] as const;

/** A snapshot whose roster carries names made of JSON's own punctuation, and stale viewer members to replace. */
function hostileSnapshot(): GameSnapshot {
  return createTestSnapshot({
    tick: 3,
    players: {
      [QUOTED_ID]: { playerId: QUOTED_ID, playerName: QUOTED_NAME },
      [SLASHED_ID]: { playerId: SLASHED_ID, playerName: SLASHED_NAME },
    },
    ownProgress: createTestPlayerProgressView({ playerName: 'stale' }),
    appliedInputSequenceByPlayer: { [QUOTED_ID]: 7, [SLASHED_ID]: 9 },
  });
}

const MEMBERS_BY_VIEWER: Readonly<Record<string, Partial<GameSnapshot>>> = {
  [QUOTED_ID]: {
    ownProgress: createTestPlayerProgressView({ playerId: QUOTED_ID, playerName: QUOTED_NAME }),
    appliedInputSequenceByPlayer: { [QUOTED_ID]: 7 },
  },
  [SLASHED_ID]: {
    ownProgress: createTestPlayerProgressView({
      playerId: SLASHED_ID,
      playerName: SLASHED_NAME,
      offer: createTestTraitOfferView(),
    }),
    appliedInputSequenceByPlayer: { [SLASHED_ID]: 9 },
  },
  [GONE_ID]: { ownProgress: null, appliedInputSequenceByPlayer: {} },
};

const VIEWER_STATE: ViewerStateSerializer = {
  keys: VIEWER_KEYS,
  serialize: (viewerPlayerId: PlayerId) => MEMBERS_BY_VIEWER[viewerPlayerId] ?? {},
};

function viewerStateModule(): GameModule {
  return { ...createSpyGameModule(), viewerState: VIEWER_STATE };
}

/** The message the splice must be equal to: the whole per-viewer object, stringified. */
function naiveMessage(snapshot: GameSnapshot, members: Partial<GameSnapshot>): string {
  return JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { ...snapshot, ...members } });
}

/** How often `"key":` appears in `frame`; no fixture name contains one, so 1 means no duplicated member. */
function memberCount(frame: string, key: string): number {
  return frame.split(`${JSON.stringify(key)}:`).length - 1;
}

describe('viewerMembersOf', () => {
  it('answers every declared member in declared order, one the module leaves out as null', () => {
    const partial: ViewerStateSerializer = {
      keys: VIEWER_KEYS,
      serialize: () => ({ appliedInputSequenceByPlayer: {} }),
    };
    const members = viewerMembersOf(partial, QUOTED_ID);
    expect(members).toEqual({ ownProgress: null, appliedInputSequenceByPlayer: {} });
    expect(Object.keys(members)).toEqual([...VIEWER_KEYS]);
  });
});

describe('snapshotForViewer', () => {
  it('is the snapshot itself for a module without viewer state', () => {
    const snapshot = createTestSnapshot();
    expect(snapshotForViewer(createSpyGameModule(), snapshot, QUOTED_ID)).toBe(snapshot);
  });

  it('carries the viewer’s declared members and leaves the snapshot alone', () => {
    const snapshot = hostileSnapshot();
    const viewed = snapshotForViewer(viewerStateModule(), snapshot, SLASHED_ID);
    expect(viewed).toEqual({ ...snapshot, ...MEMBERS_BY_VIEWER[SLASHED_ID] });
    expect(viewed.players).toBe(snapshot.players);
    expect(snapshot.ownProgress?.playerName).toBe('stale');
  });
});

describe('openSnapshotFrame and closeSnapshotFrame', () => {
  it('splice to the same JSON as each viewer’s whole message: two members, a null member, hostile names', () => {
    const snapshot = hostileSnapshot();
    const frame = openSnapshotFrame(snapshot, VIEWER_KEYS);
    for (const members of Object.values(MEMBERS_BY_VIEWER)) {
      const message = closeSnapshotFrame(frame, members);
      expect(JSON.parse(message)).toEqual(JSON.parse(naiveMessage(snapshot, members)));
      expect(message).toHaveLength(naiveMessage(snapshot, members).length);
      for (const key of VIEWER_KEYS) expect(memberCount(message, key)).toBe(1);
    }
  });

  it('close a snapshot with no shared member into valid JSON', () => {
    const message = closeSnapshotFrame(openSnapshotFrame({} as GameSnapshot, VIEWER_KEYS), MEMBERS_BY_VIEWER[GONE_ID]!);
    expect(JSON.parse(message)).toEqual({
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot: { ownProgress: null, appliedInputSequenceByPlayer: {} },
    });
  });

  it('close with no viewer members into exactly the plain message', () => {
    const snapshot = hostileSnapshot();
    const message = closeSnapshotFrame(openSnapshotFrame(snapshot, []), {});
    expect(message).toBe(JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot }));
  });
});

describe('sendSnapshotToViewers', () => {
  it('sends every connection the one snapshot, and its bytes, when the module has no viewer state', () => {
    const sent: SentLog = {};
    const targets = [QUOTED_ID, SLASHED_ID].map((id) => createTestConnection({ playerId: id, sent }));
    const snapshot = createTestSnapshot({ tick: 3 });
    const message = { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot };
    expect(sendSnapshotToViewers(createSpyGameModule(), targets, snapshot)).toBe(JSON.stringify(message).length);
    expect(sent[QUOTED_ID]).toEqual([message]);
    expect(sent[SLASHED_ID]).toEqual([message]);
  });

  it('sends each connection the snapshot with its own members and answers the mean bytes per client', () => {
    const sent: SentLog = {};
    const viewers = Object.keys(MEMBERS_BY_VIEWER);
    const targets = viewers.map((id) => createTestConnection({ playerId: id, sent }));
    const snapshot = hostileSnapshot();
    const bytes = sendSnapshotToViewers(viewerStateModule(), targets, snapshot);
    let expectedTotal = 0;
    for (const viewer of viewers) {
      const expected = naiveMessage(snapshot, MEMBERS_BY_VIEWER[viewer]!);
      expect(sent[viewer]).toEqual([JSON.parse(expected)]);
      expectedTotal += expected.length;
    }
    expect(bytes).toBe(Math.round(expectedTotal / viewers.length));
  });

  it('counts no bytes for a closed socket, and none at all with no one to send to', () => {
    const sent: SentLog = {};
    const open = createTestConnection({ playerId: QUOTED_ID, sent });
    const closed = createTestConnection({ playerId: SLASHED_ID, readyState: WebSocket.CLOSED, sent });
    const snapshot = hostileSnapshot();
    const openBytes = naiveMessage(snapshot, MEMBERS_BY_VIEWER[QUOTED_ID]!).length;
    expect(sendSnapshotToViewers(viewerStateModule(), [open, closed], snapshot)).toBe(Math.round(openBytes / 2));
    expect(sendSnapshotToViewers(viewerStateModule(), [], snapshot)).toBe(0);
  });
});
