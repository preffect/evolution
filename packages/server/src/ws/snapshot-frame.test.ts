import { describe, expect, it } from 'vitest';
import {
  SERVER_MESSAGE_TYPE,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  playerId,
  type GameSnapshot,
} from '@evolution/shared';
import { closeSnapshotFrame, openSnapshotFrame, requireViewerMember } from './snapshot-frame.js';

const QUOTED_ID = playerId('quoted');
const SLASHED_ID = playerId('slashed');
const QUOTED_NAME = 'Say "hi" }}';
const SLASHED_NAME = 'back\\slash \\" {,';
/** Two members, so the splice is exercised past one; the frame names neither. */
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

const MEMBERS_OF_EACH_VIEWER: readonly Partial<GameSnapshot>[] = [
  {
    ownProgress: createTestPlayerProgressView({ playerId: QUOTED_ID, playerName: QUOTED_NAME }),
    appliedInputSequenceByPlayer: { [QUOTED_ID]: 7 },
  },
  {
    ownProgress: createTestPlayerProgressView({
      playerId: SLASHED_ID,
      playerName: SLASHED_NAME,
      offer: createTestTraitOfferView(),
    }),
    appliedInputSequenceByPlayer: { [SLASHED_ID]: 9 },
  },
  { ownProgress: null, appliedInputSequenceByPlayer: {} },
];

/** The message the splice must be equal to: the whole per-viewer object, stringified. */
function naiveMessage(snapshot: GameSnapshot, members: Partial<GameSnapshot>): string {
  return JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { ...snapshot, ...members } });
}

/** How often `"key":` appears in `frame`; no fixture name contains one, so 1 means no duplicated member. */
function memberCount(frame: string, key: string): number {
  return frame.split(`${JSON.stringify(key)}:`).length - 1;
}

describe('openSnapshotFrame and closeSnapshotFrame', () => {
  it('splice to the same JSON as each viewer’s whole message: two members, a null member, hostile names', () => {
    const snapshot = hostileSnapshot();
    const frame = openSnapshotFrame(snapshot, VIEWER_KEYS);
    for (const members of MEMBERS_OF_EACH_VIEWER) {
      const message = closeSnapshotFrame(frame, members);
      expect(JSON.parse(message)).toEqual(JSON.parse(naiveMessage(snapshot, members)));
      expect(message).toHaveLength(naiveMessage(snapshot, members).length);
      for (const key of VIEWER_KEYS) expect(memberCount(message, key)).toBe(1);
      expect(message.endsWith(`${JSON.stringify(members.appliedInputSequenceByPlayer)}}}`)).toBe(true);
    }
  });

  it('close a snapshot with no shared member into valid JSON', () => {
    const message = closeSnapshotFrame(openSnapshotFrame({} as GameSnapshot, VIEWER_KEYS), MEMBERS_OF_EACH_VIEWER[2]!);
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

  it('refuses to close with a declared member missing instead of sending a guess', () => {
    const frame = openSnapshotFrame(hostileSnapshot(), VIEWER_KEYS);
    expect(() => closeSnapshotFrame(frame, { ownProgress: null })).toThrow(/appliedInputSequenceByPlayer/);
  });
});

describe('requireViewerMember', () => {
  it('answers a null member as null and throws for an absent one', () => {
    expect(requireViewerMember({ ownProgress: null }, 'ownProgress')).toBeNull();
    expect(() => requireViewerMember({}, 'food')).toThrow(/"food"/);
  });
});
