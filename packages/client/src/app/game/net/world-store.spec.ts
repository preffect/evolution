import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  INTERPOLATION_DELAY_TICKS,
  MAX_EXTRAPOLATION_TICKS,
  ManualClock,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_MS,
  TICK_INTERVAL_S,
  createTestSnapshot,
  entityId,
} from '@evolution/shared';
import {
  TEST_OWN_PLAYER_ID,
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestEatEffect,
  createTestLevelUpEffect,
} from '../../../testing/builders';
import { WorldStore, isSameEffect } from './world-store';

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

const HALF_TICK = 0.5;

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
    const ticks = [0, 1, 2, 3].map((index) => 60 + index * SNAPSHOT_EVERY_TICKS);
    const latest = ticks[ticks.length - 1]!;
    const { store, clock } = storeWithSnapshots(ticks);
    clock.setMilliseconds(latest * TICK_INTERVAL_MS);
    const first = store.nextFrame()!;
    expect(first.renderTick).toBeCloseTo(latest - INTERPOLATION_DELAY_TICKS, 6);
    // Due = at or before the render tick as the store computed it (a float: 63 × 16.67 ms ÷ 16.67 ms).
    const due = ticks.filter((tick) => tick <= first.renderTick);
    expect(due.length).toBeGreaterThan(0);
    expect(first.effects.map((effect) => effect.tick)).toEqual(due);
    expect(store.nextFrame()!.effects).toEqual([]);
    clock.setMilliseconds((latest + INTERPOLATION_DELAY_TICKS + MAX_EXTRAPOLATION_TICKS) * TICK_INTERVAL_MS);
    expect(store.nextFrame()!.effects.map((effect) => effect.tick)).toEqual(
      ticks.filter((tick) => !due.includes(tick)),
    );
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
    const renderTick = Math.max(60, 63 - INTERPOLATION_DELAY_TICKS);
    expect(store.renderLagMs()).toBeCloseTo((63 - renderTick) * TICK_INTERVAL_MS, 6);
  });

  it('a republished snapshot at the latest tick replaces the held frame without moving the tick estimate', () => {
    const { store, clock } = storeWithSnapshots([60, 61, 62, 63]);
    // The room is paused: the frame extrapolates to the cap and holds the latest snapshot's cell.
    const heldMs = (63 + MAX_EXTRAPOLATION_TICKS) * TICK_INTERVAL_MS;
    clock.setMilliseconds(heldMs);
    expect(store.nextFrame()!.cells[0]!.stage).toBe(CELL_STAGE.protocell);
    // A debug patch republishes tick 63 much later; the client must show it, not drop it.
    clock.setMilliseconds(heldMs * 10);
    const republished = createTestSnapshot({
      tick: 63,
      cells: [createTestCellView({ id: entityId('c'), x: 63, y: 0, stage: CELL_STAGE.eukaryote })],
    });
    expect(store.applySnapshot(republished)).toBe(true);
    expect(store.nextFrame()!.cells[0]!.stage).toBe(CELL_STAGE.eukaryote);
    expect(store.latestSnapshot()).toBe(republished);
    // The estimate was not re-observed at the late arrival: the next live tick renders at the usual delay.
    clock.setMilliseconds(64 * TICK_INTERVAL_MS);
    store.applySnapshot(createTestSnapshot({ tick: 64, cells: [createTestCellView({ id: entityId('c') })] }));
    expect(store.nextFrame()!.renderTick).toBeCloseTo(64 - INTERPOLATION_DELAY_TICKS, 6);
  });

  it("queues a republished tick's effects once: the same moment never fires twice", () => {
    const { store, clock } = storeWithSnapshots([60, 61, 62]);
    const levelUp = createTestLevelUpEffect({ tick: 63, cellId: entityId('c') });
    const absorbed = createTestCellAbsorbedEffect({
      tick: 63,
      cellId: entityId('prey'),
      predatorCellId: entityId('c'),
    });
    store.applySnapshot(createTestSnapshot({ tick: 63, effects: [levelUp, absorbed] }));
    const otherPrey = createTestCellAbsorbedEffect({
      tick: 63,
      cellId: entityId('other'),
      predatorCellId: entityId('c'),
    });
    store.applySnapshot(createTestSnapshot({ tick: 63, effects: [levelUp, absorbed, otherPrey] }));
    clock.setMilliseconds((63 + MAX_EXTRAPOLATION_TICKS) * TICK_INTERVAL_MS);
    const { effects } = store.nextFrame()!;
    expect(effects.filter((effect) => effect.tick === 63)).toEqual([levelUp, absorbed, otherPrey]);
    expect(isSameEffect(levelUp, { ...levelUp, tick: 64 })).toBe(false);
    expect(isSameEffect(levelUp, createTestEatEffect({ tick: 63, cellId: entityId('c') }))).toBe(false);
    expect(
      isSameEffect(
        { kind: 'world_level_up', tick: 63, level: 2, stage: 'prokaryote' },
        { kind: 'world_level_up', tick: 63, level: 3, stage: 'prokaryote' },
      ),
    ).toBe(true);
  });

  it('interpolates strictly between two snapshots at the live broadcast cadence', () => {
    const first = 10;
    const ticks = [0, 1, 2, 3].map((index) => first + index * SNAPSHOT_EVERY_TICKS);
    const { store, clock } = storeWithSnapshots(ticks);
    const latest = ticks[ticks.length - 1]!;
    clock.setMilliseconds((latest + HALF_TICK) * TICK_INTERVAL_MS);
    const frame = store.nextFrame()!;
    expect(frame.renderTick).toBe(latest + HALF_TICK - INTERPOLATION_DELAY_TICKS);
    expect(Number.isInteger(frame.renderTick)).toBe(false);
    // The cell sits at x = its snapshot's tick, so a lerped x equals the fractional render tick.
    expect(frame.cells[0]!.x).toBeCloseTo(frame.renderTick, 9);
  });

  it('reads the render lag without consuming the effects the next frame is owed', () => {
    const { store, clock } = storeWithSnapshots([60, 63]);
    clock.setMilliseconds(69 * TICK_INTERVAL_MS);
    expect(store.renderLagMs()).not.toBeNull();
    expect(store.nextFrame()!.effects.map((effect) => effect.tick)).toEqual([60, 63]);
  });
});
