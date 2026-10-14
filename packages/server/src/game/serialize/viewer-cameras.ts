// The server's copy of every viewer's camera (docs/architecture/wire-contract.md §4.2 lever 1): the follow and zoom the
// client renders with (`camera/camera-follow.ts`), stepped once per broadcast toward the same target, so the area a
// viewer is sent tracks what its canvas shows through a spectate, a respawn's pan and a zoom still settling. Each
// camera keeps its last `INTEREST_CAMERA_HISTORY_BROADCASTS` states, because the client draws behind the newest
// snapshot. Across the pool's move every state of every history is remapped into pool units, and the zoom then eases
// as the client's does (wire-contract.md §4 "The cameras across the move"). Serialisation state only: the simulation,
// the state hash and a replay never read it.

import {
  DISH_CENTRE_TARGET,
  GAME_ERA,
  INTEREST_CAMERA_HISTORY_BROADCASTS,
  TICK_INTERVAL_S,
  followTargetIn,
  moveCameraZoomSecondsAt,
  parkCamera,
  remapCameraAcrossMove,
  stepCamera,
  type CameraState,
  type CameraTarget,
  type GameEra,
  type PlayerId,
} from '@evolution/shared';
import { findPlayer } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import { interestAreaOf, type InterestArea } from './interest-area.js';

interface CameraHistory {
  /** Oldest first, the newest last; never empty. */
  readonly states: [CameraState, ...CameraState[]];
  /** The newest state. */
  newest: CameraState;
  /** The world tick the newest state was stepped at. */
  tick: number;
}

/** Whom `playerId`'s camera follows in `world`: what the client's follow target picks from its frame. */
export function followTargetOf(world: WorldState, playerId: PlayerId): CameraTarget | null {
  const spectatingCellId = findPlayer(world, playerId)?.spectatingCellId ?? null;
  return followTargetIn(world.cells, playerId, spectatingCellId);
}

/** Every state of `history` in pool units: no dish-coordinate rectangle stays in the cull union. */
function remapHistory(history: CameraHistory, scaleStep: number): void {
  history.states.forEach((state, index) => {
    history.states[index] = remapCameraAcrossMove(state, scaleStep);
  });
  history.newest = remapCameraAcrossMove(history.newest, scaleStep);
}

export class ViewerCameras {
  private readonly histories = new Map<PlayerId, CameraHistory>();
  /** The era the world had moved into at the previous step; `null` before the first. */
  private framedEra: GameEra | null = null;

  /**
   * One broadcast: every player's camera steps toward its target over the ticks since its last step, with the move's
   * zoom ease while it runs. On the first step after the world left the dish, every history is remapped first.
   */
  step(world: WorldState): void {
    const hasLeftTheDish = this.framedEra === GAME_ERA.dish && world.eraMovedInto !== GAME_ERA.dish;
    this.framedEra = world.eraMovedInto;
    const zoomSeconds = moveCameraZoomSecondsAt(world.tick, world.roundStartTick, world.eraMovedInto, world.balance);
    for (const { playerId } of world.players) {
      const history = this.histories.get(playerId);
      if (history === undefined) {
        this.park(world, playerId);
        continue;
      }
      if (hasLeftTheDish) remapHistory(history, world.balance.eras.ERA_SCALE_STEP);
      const deltaSeconds = (world.tick - history.tick) * TICK_INTERVAL_S;
      history.newest = stepCamera(history.newest, followTargetOf(world, playerId), deltaSeconds, zoomSeconds);
      history.tick = world.tick;
      history.states.push(history.newest);
      if (history.states.length > INTEREST_CAMERA_HISTORY_BROADCASTS) history.states.shift();
    }
  }

  /**
   * The area `playerId` is sent, each view grown by `marginWu`. A camera never stepped parks on its target first, as
   * the client's first frame does.
   */
  areaOf(world: WorldState, playerId: PlayerId, marginWu: number): InterestArea {
    const history = this.histories.get(playerId) ?? this.park(world, playerId);
    return interestAreaOf(history.states, marginWu);
  }

  /** The newest camera state of `playerId`, if it has one. */
  cameraOf(playerId: PlayerId): CameraState | undefined {
    return this.histories.get(playerId)?.newest;
  }

  /** Every state `playerId`'s area unions, oldest first; empty for a camera never parked. */
  historyOf(playerId: PlayerId): readonly CameraState[] {
    return [...(this.histories.get(playerId)?.states ?? [])];
  }

  forget(playerId: PlayerId): void {
    this.histories.delete(playerId);
  }

  private park(world: WorldState, playerId: PlayerId): CameraHistory {
    const parked = parkCamera(followTargetOf(world, playerId) ?? DISH_CENTRE_TARGET);
    const history: CameraHistory = { states: [parked], newest: parked, tick: world.tick };
    this.histories.set(playerId, history);
    return history;
  }
}
