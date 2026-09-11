import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  INTERPOLATION_DELAY_TICKS,
  MAX_EXTRAPOLATION_TICKS,
  ManualClock,
  TICK_INTERVAL_MS,
  TICK_INTERVAL_S,
  createTestSnapshot,
  entityId,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView, createTestEatEffect } from '../../../testing/builders';
import { WorldStore } from './world-store';

function storeWithSnapshots(ticks: readonly number[]): { store: WorldStore; clock: ManualClock } {
  const clock = new ManualClock(0);
  const store = new WorldStore(clock);
  store.applyBalance(DEFAULT_BALANCE);
  for (const tick of ticks) {
    clock.setMilliseconds(tick * TICK_INTERVAL_MS);
    store.applySnapshot(
      createTestSnapshot({
        tick,
        cells: [createTestCellView({ id: entityId('c'), x: tick, y: 0 })],
        dnaFragments: [{ id: entityId('f'), x: tick * 2, y: 0, tag: 'motile' }],
        effects: [createTestEatEffect({ tick })],
      }),
    );
  }
  return { store, clock };
}

describe('WorldStore', () => {
  it('answers no frame before the first snapshot, nor without a balance', () => {
    expect(new WorldStore(new ManualClock()).nextFrame()).toBeNull();
    const withoutBalance = new WorldStore(new ManualClock());
    withoutBalance.applySnapshot(createTestSnapshot({ tick: 1 }));
    expect(withoutBalance.nextFrame()).toBeNull();
  });

  it('interpolates cells and fragments at the render tick behind the newest snapshot', () => {
    const { store, clock } = storeWithSnapshots([60, 63, 66, 69]);
    clock.setMilliseconds(69 * TICK_INTERVAL_MS);
    const frame = store.nextFrame()!;
    const renderTick = 69 - INTERPOLATION_DELAY_TICKS;
    expect(frame.renderTick).toBeCloseTo(renderTick, 6);
    expect(frame.timeSeconds).toBeCloseTo(renderTick * TICK_INTERVAL_S, 9);
    expect(frame.cells[0]!.x).toBeCloseTo(renderTick, 6);
    expect(frame.fragments[0]!.x).toBeCloseTo(renderTick * 2, 6);
    expect(frame.latest.tick).toBe(69);
    expect(frame.balance).toBe(DEFAULT_BALANCE);
  });

  it('releases effects when the render tick reaches them, once, oldest first', () => {
    const { store, clock } = storeWithSnapshots([60, 63, 66, 69]);
    clock.setMilliseconds(69 * TICK_INTERVAL_MS);
    const first = store.nextFrame()!;
    expect(first.effects.map((effect) => effect.tick)).toEqual([60, 63]);
    expect(store.nextFrame()!.effects).toEqual([]);
    clock.setMilliseconds(80 * TICK_INTERVAL_MS);
    expect(store.nextFrame()!.effects.map((effect) => effect.tick)).toEqual([66, 69]);
  });

  it('extrapolates past the newest snapshot with the velocity, then holds the frame when snapshots stop', () => {
    const { store, clock } = storeWithSnapshots([60, 63]);
    store.applySnapshot(
      createTestSnapshot({ tick: 66, cells: [createTestCellView({ id: entityId('c'), x: 66, velocityX: 60 })] }),
    );
    clock.setMilliseconds(500 * TICK_INTERVAL_MS);
    const held = store.nextFrame()!;
    expect(held.renderTick).toBe(66 + MAX_EXTRAPOLATION_TICKS);
    expect(held.cells[0]!.x).toBeCloseTo(66 + MAX_EXTRAPOLATION_TICKS, 6);
    clock.setMilliseconds(900 * TICK_INTERVAL_MS);
    const later = store.nextFrame()!;
    expect([later.renderTick, later.timeSeconds, later.cells]).toEqual([held.renderTick, held.timeSeconds, held.cells]);
  });

  it('applies a game state as a reset with the balance, the own player and the avatars', () => {
    const { store, clock } = storeWithSnapshots([60, 63]);
    store.applyGameState({
      snapshot: createTestSnapshot({ tick: 5 }),
      balance: DEFAULT_BALANCE,
      playerId: TEST_OWN_PLAYER_ID,
      avatarAssignments: { [TEST_OWN_PLAYER_ID]: 2 },
    });
    clock.setMilliseconds(5 * TICK_INTERVAL_MS);
    expect(store.latestSnapshot()?.tick).toBe(5);
    expect(store.balance).toBe(DEFAULT_BALANCE);
    expect(store.ownPlayerId).toBe(TEST_OWN_PLAYER_ID);
    expect(store.avatarAssignments).toEqual({ [TEST_OWN_PLAYER_ID]: 2 });
    expect(store.nextFrame()!.cells).toEqual([]);
    store.applyBalance({ ...DEFAULT_BALANCE });
    expect(store.balance).not.toBe(DEFAULT_BALANCE);
  });

  it('ignores a stale snapshot and reports the render lag', () => {
    const { store, clock } = storeWithSnapshots([60, 63]);
    expect(store.applySnapshot(createTestSnapshot({ tick: 62 }))).toBe(false);
    clock.setMilliseconds(63 * TICK_INTERVAL_MS);
    expect(store.renderLagMs()).toBeCloseTo((63 - 60) * TICK_INTERVAL_MS, 6);
  });

  it('reads the render lag without consuming the effects the next frame is owed', () => {
    const { store, clock } = storeWithSnapshots([60, 63]);
    clock.setMilliseconds(69 * TICK_INTERVAL_MS);
    expect(store.renderLagMs()).not.toBeNull();
    expect(store.nextFrame()!.effects.map((effect) => effect.tick)).toEqual([60, 63]);
  });
});
