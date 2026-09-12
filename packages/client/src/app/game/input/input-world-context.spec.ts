import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  ROUND_PHASE,
  createTestPlayerProgressView,
  createTestSnapshot,
  playerId,
  type TraitOfferView,
} from '@evolution/shared';
import { createTestCellView, TEST_OWN_PLAYER_ID } from '../../../testing/builders';
import { WorldStore } from '../net/world-store';
import { inputWorldContextOf } from './input-world-context';

const OFFER: TraitOfferView = { offerId: 2, cards: [{ traitId: 'nucleoid', tier: 1 }], expiresAtTick: 400 };

function storeWith(snapshotOverrides: Parameters<typeof createTestSnapshot>[0] = {}): WorldStore {
  const store = new WorldStore(new ManualClock());
  store.applyGameState({
    snapshot: createTestSnapshot(snapshotOverrides),
    balance: DEFAULT_BALANCE,
    playerId: TEST_OWN_PLAYER_ID,
    avatarAssignments: {},
  });
  return store;
}

describe('inputWorldContextOf', () => {
  it('is null before the first game_state', () => {
    expect(inputWorldContextOf(new WorldStore(new ManualClock()))).toBeNull();
  });

  it('carries the own cell pose and the live steer tunables', () => {
    const store = storeWith({ cells: [createTestCellView({ playerId: TEST_OWN_PLAYER_ID, x: 7, y: 9, radius: 3 })] });
    expect(inputWorldContextOf(store)).toEqual({
      ownCell: { x: 7, y: 9, radiusWu: 3 },
      offer: null,
      controls: DEFAULT_BALANCE.controls,
    });
  });

  it('has no own cell while the player is dead', () => {
    const store = storeWith({ cells: [createTestCellView({ playerId: playerId('someone-else') })] });
    expect(inputWorldContextOf(store)?.ownCell).toBeNull();
  });

  it('carries the own player open offer', () => {
    const store = storeWith({
      players: { [TEST_OWN_PLAYER_ID]: createTestPlayerProgressView({ playerId: TEST_OWN_PLAYER_ID, offer: OFFER }) },
    });
    expect(inputWorldContextOf(store)?.offer).toEqual(OFFER);
  });

  it('is null through the results phase, where the server ignores input', () => {
    expect(inputWorldContextOf(storeWith({ roundPhase: ROUND_PHASE.results }))).toBeNull();
  });
});
