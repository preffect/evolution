// @vitest-environment node
// The move's `game_state` (docs/architecture/client.md §5, wire-contract.md §4 "The move", phases.md §14.15 PH17's
// client half): it goes through `applyGameState` like any other, so the buffer restarts in pool coordinates (no cell
// streaks from dish to pool), the own cell snaps to the snapshot's pose (no blended 1 000-wu correction), the dish
// moments the render tick had not reached are not drawn, and the move's own `era_moved` fires on its tick.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  GAME_ERA,
  INTERPOLATION_DELAY_TICKS,
  ManualClock,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_MS,
  createTestSnapshot,
  entityId,
  type CellView,
  type GameEffect,
  type GameEra,
  type GameSnapshot,
} from '@evolution/shared';
import {
  TEST_OTHER_PLAYER_ID,
  TEST_OWN_PLAYER_ID,
  createTestCellView,
  createTestLevelUpEffect,
} from '../../../testing/builders';
import { WorldStore } from './world-store';

const MOVE_TICK = 36_000;
const { ERA_SCALE_STEP } = DEFAULT_BALANCE.eras;
/** PH1's own cell before the move, and another player's cell. */
const OWN_IN_DISH = { x: 1200, y: -600 };
const OTHER_IN_DISH = { x: 900, y: 300 };
const OTHER_ID = entityId('other');
/** A dish moment on the tick before the move, which the render tick has not reached when the move arrives. */
const LAST_DISH_MOMENT = createTestLevelUpEffect({ tick: MOVE_TICK - 1 });
const ERA_MOVED: GameEffect = { kind: EFFECT_KIND.eraMoved, tick: MOVE_TICK, era: GAME_ERA.pool };

function cellsAt(scale: number): CellView[] {
  return [
    createTestCellView({ x: OWN_IN_DISH.x / scale, y: OWN_IN_DISH.y / scale }),
    createTestCellView({
      id: OTHER_ID,
      playerId: TEST_OTHER_PLAYER_ID,
      x: OTHER_IN_DISH.x / scale,
      y: OTHER_IN_DISH.y / scale,
    }),
  ];
}

function snapshotAt(tick: number, era: GameEra, effects: GameEffect[] = []): GameSnapshot {
  const scale = era === GAME_ERA.dish ? 1 : ERA_SCALE_STEP;
  return createTestSnapshot({ tick, era, cells: cellsAt(scale), effects });
}

/** Half a tick, so a render tick lands between the dish's last snapshot and the move's. */
const HALF_TICK = 0.5;

/**
 * A store in the dish up to the tick before the move, the last delta the room's closing one, with a frame drawn there;
 * then the move as `deliver` sends it, and the clock where the render tick lies half a tick before the move.
 */
function storeAcrossTheMove(deliver: 'game_state' | 'delta') {
  const clock = new ManualClock(0);
  const store = new WorldStore(clock);
  const arrive = (tick: number) => clock.setMilliseconds(tick * TICK_INTERVAL_MS);
  const closingTick = MOVE_TICK - 1;
  const firstTick = closingTick - 3 * SNAPSHOT_EVERY_TICKS;
  arrive(firstTick);
  const gameState = (snapshot: GameSnapshot) =>
    store.applyGameState({ snapshot, balance: DEFAULT_BALANCE, playerId: TEST_OWN_PLAYER_ID, avatarAssignments: {} });
  gameState(snapshotAt(firstTick, GAME_ERA.dish));
  for (let tick = firstTick + SNAPSHOT_EVERY_TICKS; tick <= closingTick; tick += SNAPSHOT_EVERY_TICKS) {
    arrive(tick);
    store.applySnapshot(snapshotAt(tick, GAME_ERA.dish, tick === closingTick ? [LAST_DISH_MOMENT] : []));
  }
  store.nextFrame();
  arrive(MOVE_TICK);
  const move = snapshotAt(MOVE_TICK, GAME_ERA.pool, [ERA_MOVED]);
  if (deliver === 'game_state') gameState(move);
  else store.applySnapshot(move);
  clock.setMilliseconds((MOVE_TICK + INTERPOLATION_DELAY_TICKS - HALF_TICK) * TICK_INTERVAL_MS);
  return { store, clock };
}

describe('WorldStore across the pool’s move', () => {
  it('restarts on the move’s game_state: every cell drawn in pool coordinates at once, the own cell snapped', () => {
    const { store } = storeAcrossTheMove('game_state');
    const frame = store.nextFrame()!;
    const other = frame.cells.find((cell) => cell.id === OTHER_ID)!;
    expect({ x: other.x, y: other.y }).toEqual({
      x: OTHER_IN_DISH.x / ERA_SCALE_STEP,
      y: OTHER_IN_DISH.y / ERA_SCALE_STEP,
    });
    const own = frame.cells.find((cell) => cell.playerId === TEST_OWN_PLAYER_ID)!;
    expect({ x: own.x, y: own.y }).toEqual({ x: OWN_IN_DISH.x / ERA_SCALE_STEP, y: OWN_IN_DISH.y / ERA_SCALE_STEP });
    expect(store.predictedOwnPose()).toMatchObject({ x: own.x, y: own.y });
    expect(frame.latest.era).toBe(GAME_ERA.pool);
  });

  it('streaks the other cells from dish to pool when the move arrives as a delta (why it is a game_state)', () => {
    const { store } = storeAcrossTheMove('delta');
    const other = store.nextFrame()!.cells.find((cell) => cell.id === OTHER_ID)!;
    expect(other.x).toBeGreaterThan(OTHER_IN_DISH.x / ERA_SCALE_STEP);
    expect(other.x).toBeLessThan(OTHER_IN_DISH.x);
  });

  it('drops the dish moments the render tick had not reached, and fires the move’s era_moved on its tick', () => {
    const { store, clock } = storeAcrossTheMove('game_state');
    const effects: GameEffect[] = [...store.nextFrame()!.effects];
    clock.setMilliseconds((MOVE_TICK + 2 * INTERPOLATION_DELAY_TICKS) * TICK_INTERVAL_MS);
    effects.push(...store.nextFrame()!.effects);
    expect(effects).toEqual([ERA_MOVED]);
  });
});
