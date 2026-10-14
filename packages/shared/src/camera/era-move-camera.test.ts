// docs/game-design/phases.md §14.4.2 step 9 and §14.4.4 cue 1: the camera remapped by the scale step on the move tick,
// then the move's zoom ease, read from the same derived move tick on both sides.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../constants/balance.js';
import { CAMERA_ZOOM_SECONDS } from '../constants/camera.js';
import { ERA_MOVE_CAMERA_EASE_SECONDS, ERA_MOVE_CAMERA_ZOOM_SECONDS, ERA_SCALE_STEP } from '../constants/eras.js';
import { DISH_RADIUS } from '../constants/world.js';
import { eraStartTicks } from '../simulation/era-clock.js';
import { secondsToTicks } from '../time/units.js';
import { GAME_ERA } from '../types/game.js';
import { parkCamera, stepCamera, type CameraState } from './camera-follow.js';
import { moveCameraZoomSecondsAt, remapCameraAcrossMove } from './era-move-camera.js';

/** PH17's camera on tick 35 999: on the PH1 cell at (1 200, −600), a mass-500 dish cell's view (§14.4.4: about 671). */
const DISH_CAMERA: CameraState = { x: 1_200, y: -600, viewHalfHeightWu: 671 };
const POOL_MOVE_TICK = 36_000;
const EASE_TICKS = secondsToTicks(ERA_MOVE_CAMERA_EASE_SECONDS);
/** PH19 case B's tick: a jump at 600 runs both moves on 601. */
const JUMP_MOVE_TICK = 601;

/** Where a world point lies on screen, as a share of the view's half-height from its centre. */
function viewOffset(camera: CameraState, x: number, y: number): [number, number] {
  return [(x - camera.x) / camera.viewHalfHeightWu, (y - camera.y) / camera.viewHalfHeightWu];
}

function withEase(easeSeconds: number, zoomSeconds: number): BalanceConfig {
  const eras = { ...DEFAULT_BALANCE.eras };
  eras.ERA_MOVE_CAMERA_EASE_SECONDS = easeSeconds;
  eras.ERA_MOVE_CAMERA_ZOOM_SECONDS = zoomSeconds;
  return { ...DEFAULT_BALANCE, eras };
}

describe('remapCameraAcrossMove', () => {
  it('divides x, y and the view’s half-height by the scale step (PH17: ÷ 10)', () => {
    expect(remapCameraAcrossMove(DISH_CAMERA, ERA_SCALE_STEP)).toEqual({ x: 120, y: -60, viewHalfHeightWu: 67.1 });
  });

  it('keeps every mapped point where it was on screen: the footprint lies where the dish’s rim was', () => {
    const remapped = remapCameraAcrossMove(DISH_CAMERA, ERA_SCALE_STEP);
    for (const [x, y] of [
      [DISH_RADIUS, 0],
      [0, -DISH_RADIUS],
      [1_500, -400],
    ] as const) {
      const [beforeX, beforeY] = viewOffset(DISH_CAMERA, x, y);
      const [afterX, afterY] = viewOffset(remapped, x / ERA_SCALE_STEP, y / ERA_SCALE_STEP);
      expect(afterX).toBeCloseTo(beforeX, 12);
      expect(afterY).toBeCloseTo(beforeY, 12);
    }
  });

  it('reads the step it is given, so a patched scale step moves it', () => {
    expect(remapCameraAcrossMove(DISH_CAMERA, 4)).toEqual({ x: 300, y: -150, viewHalfHeightWu: 167.75 });
  });
});

describe('moveCameraZoomSecondsAt', () => {
  const zoomSecondsAt = (tick: number, roundStartTick = 0, balance: BalanceConfig = DEFAULT_BALANCE) =>
    moveCameraZoomSecondsAt(tick, roundStartTick, GAME_ERA.pool, balance);

  it('eases from the pool’s move tick for ERA_MOVE_CAMERA_EASE_SECONDS, and not a tick before or after', () => {
    expect(ERA_MOVE_CAMERA_ZOOM_SECONDS).not.toBe(CAMERA_ZOOM_SECONDS);
    expect(zoomSecondsAt(POOL_MOVE_TICK - 1)).toBe(CAMERA_ZOOM_SECONDS);
    expect(zoomSecondsAt(POOL_MOVE_TICK)).toBe(ERA_MOVE_CAMERA_ZOOM_SECONDS);
    expect(zoomSecondsAt(POOL_MOVE_TICK + EASE_TICKS - 1)).toBe(ERA_MOVE_CAMERA_ZOOM_SECONDS);
    expect(zoomSecondsAt(POOL_MOVE_TICK + EASE_TICKS)).toBe(CAMERA_ZOOM_SECONDS);
  });

  it('reads the client’s fractional render tick on the same clock', () => {
    expect(zoomSecondsAt(POOL_MOVE_TICK - 0.5)).toBe(CAMERA_ZOOM_SECONDS);
    expect(zoomSecondsAt(POOL_MOVE_TICK + EASE_TICKS - 0.5)).toBe(ERA_MOVE_CAMERA_ZOOM_SECONDS);
  });

  it('never eases a world still in the dish, even on the pool’s start tick (the eras off, or a move not yet run)', () => {
    expect(moveCameraZoomSecondsAt(POOL_MOVE_TICK, 0, GAME_ERA.dish, DEFAULT_BALANCE)).toBe(CAMERA_ZOOM_SECONDS);
  });

  it('eases after a debug_set_era jump to the pool: the move tick follows the moved roundStartTick', () => {
    const roundStartTick = JUMP_MOVE_TICK - eraStartTicks(GAME_ERA.pool, DEFAULT_BALANCE);
    expect(zoomSecondsAt(JUMP_MOVE_TICK, roundStartTick)).toBe(ERA_MOVE_CAMERA_ZOOM_SECONDS);
  });

  it('lands with no ease after a jump past the pool: the pool’s start is a whole era back', () => {
    const roundStartTick = JUMP_MOVE_TICK - eraStartTicks(GAME_ERA.colonies, DEFAULT_BALANCE);
    expect(moveCameraZoomSecondsAt(JUMP_MOVE_TICK, roundStartTick, GAME_ERA.colonies, DEFAULT_BALANCE)).toBe(
      CAMERA_ZOOM_SECONDS,
    );
  });

  it('reads the room’s patched ease', () => {
    const patched = withEase(1, 2);
    expect(zoomSecondsAt(POOL_MOVE_TICK + secondsToTicks(1) - 1, 0, patched)).toBe(2);
    expect(zoomSecondsAt(POOL_MOVE_TICK + secondsToTicks(1), 0, patched)).toBe(CAMERA_ZOOM_SECONDS);
  });
});

describe('the move, end to end on the shared camera', () => {
  it('zooms out from the remapped view toward the arriving cell’s, slower during the ease than after it', () => {
    const remapped = remapCameraAcrossMove(DISH_CAMERA, ERA_SCALE_STEP);
    const arriving = { x: 120, y: -60, radius: 31 };
    const eased = stepCamera(remapped, arriving, 1, zoomSecondsAtMove());
    const ordinary = stepCamera(remapped, arriving, 1);
    expect(eased.viewHalfHeightWu).toBeGreaterThan(remapped.viewHalfHeightWu);
    expect(eased.viewHalfHeightWu).toBeLessThan(ordinary.viewHalfHeightWu);
    expect(parkCamera(arriving).viewHalfHeightWu).toBeGreaterThan(eased.viewHalfHeightWu);
  });
});

function zoomSecondsAtMove(): number {
  return moveCameraZoomSecondsAt(POOL_MOVE_TICK, 0, GAME_ERA.pool, DEFAULT_BALANCE);
}
