import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, PLAYER_LIFE_STATE, createTestSnapshot, entityId, playerId } from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import type { RenderFrame } from '../net/world-store';
import { followTarget } from './render-target';

const ownId = playerId('me');
const killer = createTestCellView({ id: entityId('k'), playerId: playerId('other'), x: 5, y: 6, radius: 7 });

function frameWith(cells: RenderFrame['cells'], spectatingCellId: string | null): RenderFrame {
  const latest = createTestSnapshot({
    cells: [...cells],
    players: {
      [ownId]: {
        playerId: ownId,
        playerName: 'own',
        level: 1,
        dnaCumulative: 0,
        dnaCatchUpGift: 0,
        dnaTowardNextLevel: 0,
        dnaTagPoints: { motile: 0, photic: 0, predatory: 0, armored: 0, toxic: 0, sensory: 0, metabolic: 0 },
        bacteriaEatenByVariant: { plain: 0, aerobic: 0, photosynthetic: 0 },
        absorptions: 0,
        wildAbsorptions: 0,
        score: 0,
        offer: null,
        lifeState: spectatingCellId === null ? PLAYER_LIFE_STATE.alive : PLAYER_LIFE_STATE.spectating,
        spectatingCellId: spectatingCellId === null ? null : entityId(spectatingCellId),
        respawnInTicks: 0,
      },
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
