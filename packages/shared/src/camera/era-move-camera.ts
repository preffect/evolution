// The shared camera across the move from the dish to the pool (docs/game-design/phases.md §14.4.2 step 9, §14.4.4).
// On the move tick every viewer camera, the server's (each state of its history) and the client's, is remapped by the
// scale step, so the dish's footprint lies where its rim was on screen; then, for `ERA_MOVE_CAMERA_EASE_SECONDS`, the
// zoom smooths with `ERA_MOVE_CAMERA_ZOOM_SECONDS` in place of `CAMERA_ZOOM_SECONDS`: one ease, not two. Pure; the
// step and the renderer call it (ticket #868).

import type { BalanceConfig } from '../constants/balance.js';
import { CAMERA_ZOOM_SECONDS } from '../constants/camera.js';
import { eraStartedAtTick } from '../simulation/era-clock.js';
import { secondsToTicks } from '../time/units.js';
import { GAME_ERA, type GameEra } from '../types/game.js';
import type { CameraState } from './camera-follow.js';

/** A camera in dish units as the same view in pool units: x, y and the view's half-height divided by `scaleStep`. */
export function remapCameraAcrossMove(state: CameraState, scaleStep: number): CameraState {
  return { x: state.x / scaleStep, y: state.y / scaleStep, viewHalfHeightWu: state.viewHalfHeightWu / scaleStep };
}

/**
 * The zoom's smoothing time constant (s) at `tick`, a whole world tick on the server or the client's fractional render
 * tick: `ERA_MOVE_CAMERA_ZOOM_SECONDS` from the pool's move tick for `ERA_MOVE_CAMERA_EASE_SECONDS`, else
 * `CAMERA_ZOOM_SECONDS`. The move tick is derived from `roundStartTick` (`eraStartedAtTick`), so the server and the
 * client read the same ease. Only the pool's move remaps the camera, so only it eases: a world still in the dish never
 * does, and a jump past the pool puts the pool's start a whole era back, so it lands with no ease. After a balance patch
 * that adds the pool or moves its start, the derived tick is the start, not the move's: fine for a cosmetic ease, never
 * for a gameplay timer, which is stored world state (architecture/wire-contract.md §4 "The cameras across the move").
 */
export function moveCameraZoomSecondsAt(
  tick: number,
  roundStartTick: number,
  eraMovedInto: GameEra,
  balance: Pick<BalanceConfig, 'eras'>,
): number {
  if (eraMovedInto === GAME_ERA.dish) return CAMERA_ZOOM_SECONDS;
  const ticksSinceMove = tick - eraStartedAtTick(GAME_ERA.pool, roundStartTick, balance);
  const isEasing = ticksSinceMove >= 0 && ticksSinceMove < secondsToTicks(balance.eras.ERA_MOVE_CAMERA_EASE_SECONDS);
  return isEasing ? balance.eras.ERA_MOVE_CAMERA_ZOOM_SECONDS : CAMERA_ZOOM_SECONDS;
}
