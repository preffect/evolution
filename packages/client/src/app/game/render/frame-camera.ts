// The renderer's camera (docs/game-design/controls-and-scope.md §7, docs/rendering/budget.md §7 "camera"): the shared
// follow and zoom stepped once per frame on the render clock, held at a fixed zoom for the bench, and carried across the
// pool's move (wire-contract.md §4 "The cameras across the move", client.md §5): on the first frame whose snapshot has
// left the dish it is remapped into pool units by the shared `remapCameraAcrossMove`, never re-parked, and its zoom
// then eases with `moveCameraZoomSecondsAt`, as the server's copy does. Every move cue keys on the snapshot's `era`,
// never on the `era_moved` effect, which a client the flow control holds never sees.

import {
  DISH_CENTRE_TARGET,
  GAME_ERA,
  moveCameraZoomSecondsAt,
  parkCamera,
  remapCameraAcrossMove,
  stepCamera,
  type CameraState,
  type CameraTarget,
  type GameEra,
} from '@evolution/shared';
import type { RenderFrame } from '../net/world-store';
import { HALF } from './geometry';
import { followTarget } from './render-target';

export class FrameCamera {
  private state: CameraState | null = null;
  private lastTimeSeconds: number | null = null;
  /** A fixed px-per-wu the bench route (slice D) asks for; `null` follows the mass-driven zoom. */
  private fixedZoom: number | null = null;
  /** The era of the snapshot the previous frame drew; `null` before the first frame. */
  private framedEra: GameEra | null = null;

  /** Parks the camera on a target (a fixture or a spawn) without smoothing. */
  parkOn(target: CameraTarget, viewportHeightPx: number): void {
    this.state = this.withFixedZoom(parkCamera(target), viewportHeightPx);
  }

  /** Holds the camera at `zoom` px per wu; `null` releases it. */
  setFixedZoom(zoom: number | null): void {
    this.fixedZoom = zoom;
  }

  /** The live camera, or one parked on the dish centre before the first frame. */
  current(): CameraState {
    return this.state ?? parkCamera(DISH_CENTRE_TARGET);
  }

  /** One frame: remapped first if its snapshot has just left the dish, then stepped toward the follow target. */
  step(frame: RenderFrame, ownPlayerId: string | null, viewportHeightPx: number): CameraState {
    const target = followTarget(frame, ownPlayerId);
    const deltaSeconds = this.lastTimeSeconds === null ? 0 : Math.max(0, frame.timeSeconds - this.lastTimeSeconds);
    this.lastTimeSeconds = frame.timeSeconds;
    const { era, roundStartTick } = frame.latest;
    const hasLeftTheDish = this.framedEra === GAME_ERA.dish && era !== GAME_ERA.dish;
    this.framedEra = era;
    if (this.state === null) {
      this.state = this.withFixedZoom(parkCamera(target ?? DISH_CENTRE_TARGET), viewportHeightPx);
      return this.state;
    }
    const from = hasLeftTheDish ? remapCameraAcrossMove(this.state, frame.balance.eras.ERA_SCALE_STEP) : this.state;
    const zoomSeconds = moveCameraZoomSecondsAt(frame.renderTick, roundStartTick, era, frame.balance);
    this.state = this.withFixedZoom(stepCamera(from, target, deltaSeconds, zoomSeconds), viewportHeightPx);
    return this.state;
  }

  private withFixedZoom(camera: CameraState, viewportHeightPx: number): CameraState {
    if (this.fixedZoom === null) return camera;
    return { ...camera, viewHalfHeightWu: (viewportHeightPx * HALF) / this.fixedZoom };
  }
}
