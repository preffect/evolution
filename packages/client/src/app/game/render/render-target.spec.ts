import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  createTestPlayerProgressView,
  createTestSnapshot,
  entityId,
  playerId,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import type { RenderFrame } from '../net/world-store';
import { followTarget } from './render-target';

const ownId = playerId('me');
const killer = createTestCellView({ id: entityId('k'), playerId: playerId('other'), x: 5, y: 6, radius: 7 });

function frameWith(cells: RenderFrame['cells'], spectatingCellId: string | null): RenderFrame {
  const latest = createTestSnapshot({
    cells: [...cells],
    players: {
      [ownId]: createTestPlayerProgressView({
        playerId: ownId,
        playerName: 'own',
        lifeState: spectatingCellId === null ? PLAYER_LIFE_STATE.alive : PLAYER_LIFE_STATE.spectating,
        spectatingCellId: spectatingCellId === null ? null : entityId(spectatingCellId),
      }),
    },
  });
  return {
    renderTick: 0,
    timeSeconds: 0,
    cells,
    motes: [],
    fragments: [],
    effects: [],
    latest,
    balance: DEFAULT_BALANCE,
  };
}

describe('followTarget', () => {
  it('follows the own cell while alive', () => {
    const own = createTestCellView({ id: entityId('ownId-cell'), playerId: ownId, x: 1, y: 2, radius: 3 });
    expect(followTarget(frameWith([own, killer], null), ownId)).toEqual({ x: 1, y: 2, radius: 3 });
  });

  it('follows the killer while spectating and nothing when the killer is gone or there is no player', () => {
    expect(followTarget(frameWith([killer], 'k'), ownId)).toEqual({ x: 5, y: 6, radius: 7 });
    expect(followTarget(frameWith([], 'k'), ownId)).toBeNull();
    expect(followTarget(frameWith([killer], null), null)).toBeNull();
  });
});
