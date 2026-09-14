import { describe, expect, it } from 'vitest';
import {
  SERVER_MESSAGE_TYPE,
  createTestPlayerProgressView,
  createTestSnapshot,
  playerId,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
import type { GameModule } from '../game/game-module.js';
import { createSpyGameModule, createTestConnection, type SentLog } from '../testing/builders.js';
import { sendSnapshotToViewers, snapshotForViewer } from './viewer-snapshots.js';

const SHORT_ID = playerId('p1');
const LONG_ID = playerId('a-much-longer-player-id');

/** A module whose projection puts the viewer's own progress on the snapshot, as the Evolution module does. */
function projectingModule(): GameModule {
  return {
    ...createSpyGameModule(),
    snapshotForViewer: (snapshot: GameSnapshot, viewerPlayerId: PlayerId) => ({
      ...snapshot,
      ownProgress: createTestPlayerProgressView({ playerId: viewerPlayerId }),
    }),
  };
}

function bytesOf(snapshot: GameSnapshot): number {
  return JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot }).length;
}

describe('snapshotForViewer', () => {
  it('is the snapshot itself for a module without a projection', () => {
    const snapshot = createTestSnapshot();
    expect(snapshotForViewer(createSpyGameModule(), snapshot, SHORT_ID)).toBe(snapshot);
  });

  it('is the module’s projection for the viewer', () => {
    expect(snapshotForViewer(projectingModule(), createTestSnapshot(), SHORT_ID).ownProgress?.playerId).toBe(SHORT_ID);
  });
});

describe('sendSnapshotToViewers', () => {
  it('sends every connection the one snapshot, and its bytes, when the module does not project', () => {
    const sent: SentLog = {};
    const targets = [SHORT_ID, LONG_ID].map((id) => createTestConnection({ playerId: id, sent }));
    const snapshot = createTestSnapshot({ tick: 3 });
    expect(sendSnapshotToViewers(createSpyGameModule(), targets, snapshot)).toBe(bytesOf(snapshot));
    expect(sent[SHORT_ID]).toEqual([{ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot }]);
    expect(sent[LONG_ID]).toEqual(sent[SHORT_ID]);
  });

  it('sends each connection its own projection and answers the mean bytes per client', () => {
    const sent: SentLog = {};
    const targets = [SHORT_ID, LONG_ID].map((id) => createTestConnection({ playerId: id, sent }));
    const game = projectingModule();
    const snapshot = createTestSnapshot({ tick: 3 });
    const bytes = sendSnapshotToViewers(game, targets, snapshot);
    const [shortView, longView] = [SHORT_ID, LONG_ID].map((id) => snapshotForViewer(game, snapshot, id)) as [
      GameSnapshot,
      GameSnapshot,
    ];
    expect(sent[SHORT_ID]).toEqual([{ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: shortView }]);
    expect(sent[LONG_ID]).toEqual([{ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: longView }]);
    expect(bytes).toBe(Math.round((bytesOf(shortView) + bytesOf(longView)) / targets.length));
  });

  it('answers no bytes when there is no one to send to', () => {
    expect(sendSnapshotToViewers(projectingModule(), [], createTestSnapshot())).toBe(0);
  });
});
