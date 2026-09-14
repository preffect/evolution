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
  type PlayerProgressView,
} from '@evolution/shared';
import type { GameModule } from '../game/game-module.js';
import { createSpyGameModule, createTestConnection, type SentLog } from '../testing/builders.js';
import { closeSnapshotFrame, openSnapshotFrame, sendSnapshotToViewers, snapshotForViewer } from './viewer-snapshots.js';

const QUOTED_ID = playerId('quoted');
const SLASHED_ID = playerId('slashed');
const QUOTED_NAME = 'Say "hi" }}';
const SLASHED_NAME = 'back\\slash \\" {,';
/** The text the splice writes once; no name below contains it, so a count can see a duplicate member. */
const OWN_PROGRESS_MEMBER = '"ownProgress":';

/** A snapshot whose roster carries names made of JSON's own punctuation, and a stale own progress to replace. */
function hostileSnapshot(): GameSnapshot {
  return createTestSnapshot({
    tick: 3,
    players: {
      [QUOTED_ID]: { playerId: QUOTED_ID, playerName: QUOTED_NAME },
      [SLASHED_ID]: { playerId: SLASHED_ID, playerName: SLASHED_NAME },
    },
    ownProgress: createTestPlayerProgressView({ playerName: 'stale' }),
  });
}

const OWN_PROGRESS_BY_VIEWER: Readonly<Record<string, PlayerProgressView | null>> = {
  [QUOTED_ID]: createTestPlayerProgressView({ playerId: QUOTED_ID, playerName: QUOTED_NAME }),
  [SLASHED_ID]: createTestPlayerProgressView({
    playerId: SLASHED_ID,
    playerName: SLASHED_NAME,
    offer: createTestTraitOfferView(),
  }),
  [playerId('gone')]: null,
};

/** A module whose own progress for a viewer is the table above. */
function ownProgressModule(): GameModule {
  return {
    ...createSpyGameModule(),
    serializeOwnProgress: (viewerPlayerId: PlayerId) => OWN_PROGRESS_BY_VIEWER[viewerPlayerId] ?? null,
  };
}

/** The message the splice must be equal to: the whole per-viewer object, stringified. */
function naiveMessage(snapshot: GameSnapshot, ownProgress: PlayerProgressView | null): string {
  return JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { ...snapshot, ownProgress } });
}

describe('snapshotForViewer', () => {
  it('is the snapshot itself for a module without own progress', () => {
    const snapshot = createTestSnapshot();
    expect(snapshotForViewer(createSpyGameModule(), snapshot, QUOTED_ID)).toBe(snapshot);
  });

  it('carries the module’s own progress for the viewer and leaves the snapshot alone', () => {
    const snapshot = hostileSnapshot();
    const viewed = snapshotForViewer(ownProgressModule(), snapshot, SLASHED_ID);
    expect(viewed.ownProgress).toBe(OWN_PROGRESS_BY_VIEWER[SLASHED_ID]);
    expect(viewed.players).toBe(snapshot.players);
    expect(snapshot.ownProgress?.playerName).toBe('stale');
  });
});

describe('openSnapshotFrame and closeSnapshotFrame', () => {
  it('splice to the same JSON as stringifying each viewer’s message whole, null and hostile names included', () => {
    const snapshot = hostileSnapshot();
    const openFrame = openSnapshotFrame(snapshot);
    for (const ownProgress of Object.values(OWN_PROGRESS_BY_VIEWER)) {
      const frame = closeSnapshotFrame(openFrame, ownProgress);
      expect(JSON.parse(frame)).toEqual(JSON.parse(naiveMessage(snapshot, ownProgress)));
      expect(frame.split(OWN_PROGRESS_MEMBER)).toHaveLength(2);
      expect(frame).toHaveLength(naiveMessage(snapshot, ownProgress).length);
    }
  });

  it('close a snapshot with no other member into valid JSON', () => {
    const frame = closeSnapshotFrame(openSnapshotFrame({} as GameSnapshot), null);
    expect(JSON.parse(frame)).toEqual({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { ownProgress: null } });
  });
});

describe('sendSnapshotToViewers', () => {
  it('sends every connection the one snapshot, and its bytes, when the module has no own progress', () => {
    const sent: SentLog = {};
    const targets = [QUOTED_ID, SLASHED_ID].map((id) => createTestConnection({ playerId: id, sent }));
    const snapshot = createTestSnapshot({ tick: 3 });
    const message = { type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot };
    expect(sendSnapshotToViewers(createSpyGameModule(), targets, snapshot)).toBe(JSON.stringify(message).length);
    expect(sent[QUOTED_ID]).toEqual([message]);
    expect(sent[SLASHED_ID]).toEqual([message]);
  });

  it('sends each connection the snapshot with its own progress and answers the mean bytes per client', () => {
    const sent: SentLog = {};
    const viewers = Object.keys(OWN_PROGRESS_BY_VIEWER);
    const targets = viewers.map((id) => createTestConnection({ playerId: id, sent }));
    const snapshot = hostileSnapshot();
    const bytes = sendSnapshotToViewers(ownProgressModule(), targets, snapshot);
    let expectedTotal = 0;
    for (const viewer of viewers) {
      const expected = naiveMessage(snapshot, OWN_PROGRESS_BY_VIEWER[viewer] ?? null);
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
    const openBytes = naiveMessage(snapshot, OWN_PROGRESS_BY_VIEWER[QUOTED_ID] ?? null).length;
    expect(sendSnapshotToViewers(ownProgressModule(), [open, closed], snapshot)).toBe(Math.round(openBytes / 2));
    expect(sendSnapshotToViewers(ownProgressModule(), [], snapshot)).toBe(0);
  });
});
