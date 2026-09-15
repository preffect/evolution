// The server's copy of every viewer's camera (docs/architecture/wire-contract.md §4.2 lever 1): the follow and zoom the
// client renders with (`simulation/camera-follow.ts`), stepped once per broadcast toward the same target, so the area a
// viewer is sent tracks what its canvas shows through a spectate, a respawn's pan and a zoom still settling. Each
// camera keeps its last `INTEREST_CAMERA_HISTORY_BROADCASTS` states, because the client draws behind the newest
// snapshot. Serialisation state only: the simulation, the state hash and a replay never read it.

import {
  DISH_CENTRE_TARGET,
  INTEREST_CAMERA_HISTORY_BROADCASTS,
  TICK_INTERVAL_S,
  followTargetIn,
  parkCamera,
  stepCamera,
  type CameraState,
  type CameraTarget,
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

export class ViewerCameras {
  private readonly histories = new Map<PlayerId, CameraHistory>();

  /** One broadcast: every player's camera steps toward its target over the ticks since its last step. */
  step(world: WorldState): void {
    for (const { playerId } of world.players) {
      const history = this.histories.get(playerId);
      if (history === undefined) {
        this.park(world, playerId);
        continue;
      }
      const deltaSeconds = (world.tick - history.tick) * TICK_INTERVAL_S;
      history.newest = stepCamera(history.newest, followTargetOf(world, playerId), deltaSeconds);
      history.tick = world.tick;
      history.states.push(history.newest);
      if (history.states.length > INTEREST_CAMERA_HISTORY_BROADCASTS) history.states.shift();
    }
  }

  /** The area `playerId` is sent. A camera never stepped parks on its target first, as the client's first frame does. */
  areaOf(world: WorldState, playerId: PlayerId): InterestArea {
    const history = this.histories.get(playerId) ?? this.park(world, playerId);
    return interestAreaOf(history.states);
  }

  /** The newest camera state of `playerId`, if it has one. */
  cameraOf(playerId: PlayerId): CameraState | undefined {
    return this.histories.get(playerId)?.newest;
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
