import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  INTERPOLATION_DELAY_TICKS,
  EFFECT_DRAW_WINDOW_TICKS,
  MAX_EXTRAPOLATION_TICKS,
  ManualClock,
  SNAPSHOT_BUFFER_SIZE,
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
/**
 * Clock offset past the newest snapshot at which the render tick reaches the extrapolation cap and
 * the frame holds: the interpolation delay first, then the cap. A paused room's tests wait this long.
 */
const HELD_FRAME_LOOKAHEAD_TICKS = INTERPOLATION_DELAY_TICKS + MAX_EXTRAPOLATION_TICKS;

/** `count` snapshot ticks from `first` at the live broadcast cadence, the way the room sends them. */
function cadenceTicks(first: number, count: number): number[] {
  return Array.from({ length: count }, (_unused, index) => first + index * SNAPSHOT_EVERY_TICKS);
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
    const ticks = cadenceTicks(60, 4);
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
    const ticks = cadenceTicks(60, 4);
    const latest = ticks[ticks.length - 1]!;
    const { store, clock } = storeWithSnapshots(ticks);
    // The room is paused: the frame extrapolates to the cap and holds the latest snapshot's cell.
    const heldMs = (latest + HELD_FRAME_LOOKAHEAD_TICKS) * TICK_INTERVAL_MS;
    clock.setMilliseconds(heldMs);
    expect(store.nextFrame()!.cells[0]!.stage).toBe(CELL_STAGE.protocell);
    // A debug patch republishes the latest tick much later; the client must show it, not drop it.
    clock.setMilliseconds(heldMs * 10);
    const republished = createTestSnapshot({
      tick: latest,
      cells: [createTestCellView({ id: entityId('c'), x: latest, y: 0, stage: CELL_STAGE.eukaryote })],
    });
    expect(store.applySnapshot(republished)).toBe(true);
    expect(store.nextFrame()!.cells[0]!.stage).toBe(CELL_STAGE.eukaryote);
    expect(store.latestSnapshot()).toBe(republished);
    // The estimate was not re-observed at the late arrival: the next live tick renders at the usual delay.
    const next = latest + SNAPSHOT_EVERY_TICKS;
    clock.setMilliseconds(next * TICK_INTERVAL_MS);
    store.applySnapshot(createTestSnapshot({ tick: next, cells: [createTestCellView({ id: entityId('c') })] }));
    expect(store.nextFrame()!.renderTick).toBeCloseTo(next - INTERPOLATION_DELAY_TICKS, 6);
  });

  it('never re-fires a moment already drained when its tick is republished after the render tick ran past it', () => {
    const ticks = cadenceTicks(60, 3);
    const paused = ticks[ticks.length - 1]! + SNAPSHOT_EVERY_TICKS;
    const { store, clock } = storeWithSnapshots(ticks);
    const levelUp = createTestLevelUpEffect({ tick: paused, cellId: entityId('c') });
    store.applySnapshot(createTestSnapshot({ tick: paused, effects: [levelUp] }));
    // The room is paused: the render tick extrapolates past the latest tick and drains the level-up.
    clock.setMilliseconds((paused + HELD_FRAME_LOOKAHEAD_TICKS) * TICK_INTERVAL_MS);
    expect(store.nextFrame()!.effects).toContainEqual(levelUp);
    // A debug tool republishes the same tick with the same effect: nothing fires again.
    store.applySnapshot(createTestSnapshot({ tick: paused, effects: [levelUp] }));
    expect(store.nextFrame()!.effects).toEqual([]);
    // A newer tick forgets the drained set: the same moment one snapshot on is a new moment.
    const resumed = paused + SNAPSHOT_EVERY_TICKS;
    clock.setMilliseconds(resumed * TICK_INTERVAL_MS);
    const later = { ...levelUp, tick: resumed };
    store.applySnapshot(createTestSnapshot({ tick: resumed, effects: [later] }));
    clock.setMilliseconds((resumed + HELD_FRAME_LOOKAHEAD_TICKS) * TICK_INTERVAL_MS);
    expect(store.nextFrame()!.effects).toEqual([later]);
    store.reset();
    expect(store.nextFrame()).toBeNull();
  });

  it("queues a republished tick's effects once: the same moment never fires twice", () => {
    const ticks = cadenceTicks(60, 3);
    const paused = ticks[ticks.length - 1]! + SNAPSHOT_EVERY_TICKS;
    const { store, clock } = storeWithSnapshots(ticks);
    const levelUp = createTestLevelUpEffect({ tick: paused, cellId: entityId('c') });
    const absorbed = createTestCellAbsorbedEffect({
      tick: paused,
      cellId: entityId('prey'),
      predatorCellId: entityId('c'),
    });
    store.applySnapshot(createTestSnapshot({ tick: paused, effects: [levelUp, absorbed] }));
    const otherPrey = createTestCellAbsorbedEffect({
      tick: paused,
      cellId: entityId('other'),
      predatorCellId: entityId('c'),
    });
    store.applySnapshot(createTestSnapshot({ tick: paused, effects: [levelUp, absorbed, otherPrey] }));
    clock.setMilliseconds((paused + HELD_FRAME_LOOKAHEAD_TICKS) * TICK_INTERVAL_MS);
    const { effects } = store.nextFrame()!;
    expect(effects.filter((effect) => effect.tick === paused)).toEqual([levelUp, absorbed, otherPrey]);
    expect(isSameEffect(levelUp, { ...levelUp, tick: paused + 1 })).toBe(false);
    expect(isSameEffect(levelUp, createTestEatEffect({ tick: paused, cellId: entityId('c') }))).toBe(false);
    expect(
      isSameEffect(
        { kind: 'world_level_up', tick: 63, level: 2, stage: 'prokaryote' },
        { kind: 'world_level_up', tick: 63, level: 3, stage: 'prokaryote' },
      ),
    ).toBe(true);
  });

  it('interpolates strictly between two snapshots at the live broadcast cadence', () => {
    const ticks = cadenceTicks(10, 4);
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

/** Snapshots a streaming test feeds, and how much longer the long starve runs than the brief one. */
const STREAM_SNAPSHOTS = 300;
const BRIEF_STARVE_BUFFERS = 4;
const BRIEF_STARVE_SNAPSHOTS = SNAPSHOT_BUFFER_SIZE * BRIEF_STARVE_BUFFERS;
const LONG_STARVE_MULTIPLE = 100;
/** A frame rate well below the window, for the half of the trade that loses effects. */
const TOO_SLOW_MULTIPLE = 4;
/** Drawing exactly at the window is marginal, not lossless: the tick estimate drifts either side of it. */
const MARGINAL_LOSS_FLOOR_SHARE = 0.95;

describe('WorldStore: a client that ingests faster than it renders (#238, the survival half)', () => {
  /**
   * Streams snapshots at the wire cadence, one effect each, drawing a frame every `frameEveryTicks`
   * (`null` draws none at all), and answers what the run fired and what the store still held at the
   * end. The two numbers are the whole trade: what a client sees, and what it is carrying to see it.
   */
  function streamWhileDrawing(snapshotCount: number, frameEveryTicks: number | null) {
    const clock = new ManualClock(0);
    const store = new WorldStore(clock);
    store.applyBalance(DEFAULT_BALANCE);
    let fired = 0;
    let ticksSinceFrame = 0;
    let tick = 0;
    for (let index = 0; index < snapshotCount; index += 1) {
      tick += SNAPSHOT_EVERY_TICKS;
      clock.setMilliseconds(tick * TICK_INTERVAL_MS);
      store.applySnapshot(createTestSnapshot({ tick, effects: [createTestEatEffect({ tick })] }));
      ticksSinceFrame += SNAPSHOT_EVERY_TICKS;
      if (frameEveryTicks !== null && ticksSinceFrame >= frameEveryTicks) {
        ticksSinceFrame = 0;
        fired += store.nextFrame()!.effects.length;
      }
    }
    // One frame far enough ahead that everything still held comes out at once.
    clock.setMilliseconds((tick + HELD_FRAME_LOOKAHEAD_TICKS) * TICK_INTERVAL_MS);
    const held = store.nextFrame()!.effects.length;
    return { fired: fired + held, held };
  }

  it('stops accumulating: a starve a hundred times longer holds no more', () => {
    const brief = streamWhileDrawing(BRIEF_STARVE_SNAPSHOTS, null).held;
    const long = streamWhileDrawing(BRIEF_STARVE_SNAPSHOTS * LONG_STARVE_MULTIPLE, null).held;
    // The growth assertion first, and on its own: it is the property, and without the bound the two
    // differ by the whole starve. The size assertion below only says which bound it settled at.
    expect(long).toBe(brief);
    expect(long).toBeLessThanOrEqual(SNAPSHOT_BUFFER_SIZE);
  });

  it('loses effects in proportion to how far below EFFECT_DRAW_WINDOW_TICKS the client draws', () => {
    // The window is what the bound costs: derived in `netcode.ts`, 6 ticks / 100 ms / 10 fps today.
    const comfortable = streamWhileDrawing(STREAM_SNAPSHOTS, SNAPSHOT_EVERY_TICKS).fired;
    const atWindow = streamWhileDrawing(STREAM_SNAPSHOTS, EFFECT_DRAW_WINDOW_TICKS).fired;
    const wellBelow = streamWhileDrawing(STREAM_SNAPSHOTS, EFFECT_DRAW_WINDOW_TICKS * TOO_SLOW_MULTIPLE).fired;
    // The pin on the bound: without it nothing is ever dropped and all three are equal.
    expect(wellBelow).toBeLessThan(atWindow);
    expect(atWindow).toBeLessThanOrEqual(comfortable);
    // A frame per snapshot loses nothing; at the window's edge the tick estimate's drift costs a few.
    expect(comfortable).toBe(STREAM_SNAPSHOTS);
    expect(atWindow).toBeGreaterThanOrEqual(STREAM_SNAPSHOTS * MARGINAL_LOSS_FLOOR_SHARE);
  });
});
