// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  ROUND_PHASE,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  playerId,
} from '@evolution/shared';
import { createTestCellView, TEST_OWN_PLAYER_ID } from '../../../testing/builders';
import { WorldStore } from '../net/world-store';
import { inputWorldContextOf } from './input-world-context';

const OFFER = createTestTraitOfferView({ offerId: 2, cards: [{ traitId: 'nucleoid', tier: 1 }], expiresAtTick: 400 });

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
      appliedInputSequence: 0,
    });
  });

  it('carries the predicted pose once inputs are in flight, so the steer target hangs off where the cell will be', () => {
    const store = storeWith({ cells: [createTestCellView({ playerId: TEST_OWN_PLAYER_ID, radius: 18 })] });
    store.recordOwnInput({ sequence: 1, targetX: 400, targetY: 0, shouldSprint: false, traitChoice: null });
    const predicted = store.predictedOwnPose()!;
    expect(predicted.x).toBeGreaterThan(0);
    expect(inputWorldContextOf(store)?.ownCell).toEqual({ x: predicted.x, y: predicted.y, radiusWu: 18 });
  });

  it('has no own cell while the player is dead', () => {
    const store = storeWith({ cells: [createTestCellView({ playerId: playerId('someone-else') })] });
    expect(inputWorldContextOf(store)?.ownCell).toBeNull();
  });

  it('carries the own player open offer', () => {
    const store = storeWith({
      ownProgress: createTestPlayerProgressView({ playerId: TEST_OWN_PLAYER_ID, offer: OFFER }),
    });
    expect(inputWorldContextOf(store)?.offer).toEqual(OFFER);
  });

  it('carries the sequence the server last applied for this player', () => {
    const store = storeWith({ appliedInputSequenceByPlayer: { [TEST_OWN_PLAYER_ID]: 412 } });
    expect(inputWorldContextOf(store)?.appliedInputSequence).toBe(412);
  });

  // The invariant `trait-pick.ts` retries against: both facts describe one moment of the server's
  // world, so a newer snapshot can never leave a stale offer paired with a fresh applied sequence.
  it('pairs the offer with the applied sequence of the same snapshot', () => {
    const store = storeWith({
      tick: 10,
      ownProgress: createTestPlayerProgressView({ playerId: TEST_OWN_PLAYER_ID, offer: OFFER }),
      appliedInputSequenceByPlayer: { [TEST_OWN_PLAYER_ID]: 5 },
    });
    expect(inputWorldContextOf(store)).toMatchObject({ offer: OFFER, appliedInputSequence: 5 });
    store.applySnapshot(
      createTestSnapshot({
        tick: 11,
        ownProgress: createTestPlayerProgressView({ playerId: TEST_OWN_PLAYER_ID }),
        appliedInputSequenceByPlayer: { [TEST_OWN_PLAYER_ID]: 9 },
      }),
    );
    expect(inputWorldContextOf(store)).toMatchObject({ offer: null, appliedInputSequence: 9 });
  });

  it('is null through the results phase, where the server ignores input', () => {
    expect(inputWorldContextOf(storeWith({ roundPhase: ROUND_PHASE.results }))).toBeNull();
  });
});
