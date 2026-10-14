// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CAMERA_ZOOM_SECONDS,
  DEFAULT_BALANCE,
  GAME_ERA,
  TICK_INTERVAL_S,
  createTestSnapshot,
  eraStartedAtTick,
  parkCamera,
  remapCameraAcrossMove,
  secondsToTicks,
  stepCamera,
  type CameraTarget,
  type GameEra,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView, createTestRenderFrame } from '../../../testing/builders';
import { FrameCamera } from './frame-camera';

const { eras } = DEFAULT_BALANCE;
const VIEWPORT_HEIGHT_PX = 600;
/** The pool's move tick in a round started on tick 0. */
const MOVE_TICK = eraStartedAtTick(GAME_ERA.pool, 0, DEFAULT_BALANCE);
const FRAME_TICKS = 3;

/** The render clock's step into the frame at `tick`, computed as the camera computes it from the frames' times. */
function frameSecondsTo(tick: number): number {
  return tick * TICK_INTERVAL_S - (tick - FRAME_TICKS) * TICK_INTERVAL_S;
}
/** PH1's cell before the move (mass 500) and after it (the arrival mass), as phases.md §14.4.4 sizes them. */
const DISH_CELL: CameraTarget = { x: 1200, y: -600, radius: 89 };
const POOL_CELL: CameraTarget = { x: 120, y: -60, radius: 31 };

function frameAt(renderTick: number, era: GameEra, cell: CameraTarget) {
  const cells = [createTestCellView({ x: cell.x, y: cell.y, radius: cell.radius })];
  return createTestRenderFrame({
    renderTick,
    timeSeconds: renderTick * TICK_INTERVAL_S,
    cells,
    latest: createTestSnapshot({ cells, era, roundStartTick: 0 }),
  });
}

function step(camera: FrameCamera, renderTick: number, era: GameEra, cell: CameraTarget) {
  return camera.step(frameAt(renderTick, era, cell), TEST_OWN_PLAYER_ID, VIEWPORT_HEIGHT_PX);
}

describe('FrameCamera across the pool’s move (wire-contract.md §4 "The cameras across the move")', () => {
  it('remaps on the first frame whose snapshot left the dish, then eases the zoom with the move’s constant', () => {
    const camera = new FrameCamera();
    const parked = step(camera, MOVE_TICK - FRAME_TICKS, GAME_ERA.dish, DISH_CELL);
    expect(parked).toEqual(parkCamera(DISH_CELL));
    const remapped = remapCameraAcrossMove(parked, eras.ERA_SCALE_STEP);
    const moved = step(camera, MOVE_TICK, GAME_ERA.pool, POOL_CELL);
    const zoomSeconds = eras.ERA_MOVE_CAMERA_ZOOM_SECONDS;
    expect(moved).toEqual(stepCamera(remapped, POOL_CELL, frameSecondsTo(MOVE_TICK), zoomSeconds));
    // Not re-parked: the view starts from the dish's view in pool units, not on the arriving cell's.
    expect(moved.viewHalfHeightWu).toBeLessThan(parkCamera(POOL_CELL).viewHalfHeightWu);
    // Once only: the next pool frame steps from there.
    const next = step(camera, MOVE_TICK + FRAME_TICKS, GAME_ERA.pool, POOL_CELL);
    expect(next).toEqual(stepCamera(moved, POOL_CELL, frameSecondsTo(MOVE_TICK + FRAME_TICKS), zoomSeconds));
  });

  it('eases with the move’s constant for ERA_MOVE_CAMERA_EASE_SECONDS from the move tick, then with the camera’s', () => {
    const camera = new FrameCamera();
    const easeEndTick = MOVE_TICK + secondsToTicks(eras.ERA_MOVE_CAMERA_EASE_SECONDS);
    // Parked on the dish-sized cell, so the zoom still has a way to go toward the pool cell's view.
    step(camera, easeEndTick - 2 * FRAME_TICKS, GAME_ERA.pool, DISH_CELL);
    const lastEaseTick = easeEndTick - FRAME_TICKS;
    const lastEased = step(camera, lastEaseTick, GAME_ERA.pool, POOL_CELL);
    const after = step(camera, easeEndTick, GAME_ERA.pool, POOL_CELL);
    const seconds = frameSecondsTo(easeEndTick);
    expect(after).toEqual(stepCamera(lastEased, POOL_CELL, seconds, CAMERA_ZOOM_SECONDS));
    expect(after).not.toEqual(stepCamera(lastEased, POOL_CELL, seconds, eras.ERA_MOVE_CAMERA_ZOOM_SECONDS));
  });

  it('never remaps a camera that first framed the pool (a late join) or the colonies’ move', () => {
    const camera = new FrameCamera();
    expect(step(camera, MOVE_TICK, GAME_ERA.pool, POOL_CELL)).toEqual(parkCamera(POOL_CELL));
    const inPool = step(camera, MOVE_TICK + FRAME_TICKS, GAME_ERA.pool, POOL_CELL);
    const coloniesTick = MOVE_TICK + 2 * FRAME_TICKS;
    const colonies = step(camera, coloniesTick, GAME_ERA.colonies, POOL_CELL);
    const seconds = frameSecondsTo(coloniesTick);
    expect(colonies).toEqual(stepCamera(inPool, POOL_CELL, seconds, eras.ERA_MOVE_CAMERA_ZOOM_SECONDS));
  });

  it('steps with the camera’s own zoom constant while the round stays in the dish', () => {
    const camera = new FrameCamera();
    const parked = step(camera, 0, GAME_ERA.dish, DISH_CELL);
    const stepped = step(camera, FRAME_TICKS, GAME_ERA.dish, POOL_CELL);
    expect(stepped).toEqual(stepCamera(parked, POOL_CELL, frameSecondsTo(FRAME_TICKS), CAMERA_ZOOM_SECONDS));
  });

  it('keeps a fixed zoom through the remap', () => {
    const camera = new FrameCamera();
    const zoom = 2;
    camera.setFixedZoom(zoom);
    step(camera, MOVE_TICK - FRAME_TICKS, GAME_ERA.dish, DISH_CELL);
    const moved = step(camera, MOVE_TICK, GAME_ERA.pool, POOL_CELL);
    expect(moved.viewHalfHeightWu).toBe(VIEWPORT_HEIGHT_PX / 2 / zoom);
  });
});
