// What each viewer alone is sent of a snapshot (docs/architecture/wire-contract.md §4.1, §4.2 lever 1): its own
// progress, its own applied input sequence, and the food and DNA fragments inside its interest area. The food is a
// delta per viewer: a mote entering the area is `spawned` for that viewer, one leaving it is in `removedIds`, and one
// inside it that moved is in `moved`. A `game_state` restarts that delta from the motes it carries. The shared
// snapshot keeps every mote and fragment for no viewer (a debug read, a scenario).

import type { FoodDelta, GameSnapshot, PlayerId } from '@evolution/shared';
import type { ViewerStateSerializer } from '../game-module.js';
import type { WorldState } from '../world/world-state.js';
import { FoodDeltaTracker, positionMotes, type PositionedMote } from './food-delta-tracker.js';
import { isInInterestArea, type InterestArea } from './interest-area.js';
import { ownProgressOf } from './serialize.js';
import { ViewerCameras } from './viewer-cameras.js';

/** The snapshot members only their viewer is sent, in the order the room appends them. */
export const VIEWER_SNAPSHOT_KEYS = [
  'food',
  'dnaFragments',
  'ownProgress',
  'appliedInputSequenceByPlayer',
] as const satisfies readonly (keyof GameSnapshot)[];

export type ViewerSnapshotKey = (typeof VIEWER_SNAPSHOT_KEYS)[number];

/** One viewer's values for `VIEWER_SNAPSHOT_KEYS`. */
export type ViewerSnapshotMembers = Pick<GameSnapshot, ViewerSnapshotKey>;

function foodInArea(food: readonly PositionedMote[], area: InterestArea): PositionedMote[] {
  return food.filter(({ position }) => isInInterestArea(area, position.x, position.y));
}

/** The viewer's own entry of the applied input sequences: the only one its prediction reads. */
function ownSequenceOf(snapshot: GameSnapshot, viewerPlayerId: PlayerId): Record<string, number> {
  const sequence = snapshot.appliedInputSequenceByPlayer[viewerPlayerId];
  return sequence === undefined ? {} : { [viewerPlayerId]: sequence };
}

export class EvolutionViewerState implements ViewerStateSerializer<GameSnapshot, ViewerSnapshotKey> {
  readonly keys = VIEWER_SNAPSHOT_KEYS;
  private readonly cameras = new ViewerCameras();
  private readonly foodDeltas = new Map<PlayerId, FoodDeltaTracker>();
  /** This broadcast's quantised food, shared by every viewer's delta; `null` before the first broadcast. */
  private broadcastFood: PositionedMote[] | null = null;

  constructor(private readonly world: WorldState) {}

  /** Once per broadcast, before any viewer is serialised: every viewer's camera steps and the food is quantised once. */
  observeBroadcast(): void {
    this.cameras.step(this.world);
    this.broadcastFood = positionMotes(this.world.food);
  }

  /** Always right after this broadcast's `serializeRoomState`, so the food quantised there is the world's now. */
  serialize(viewerPlayerId: PlayerId, snapshot: GameSnapshot): ViewerSnapshotMembers {
    const tracker = this.foodDeltas.get(viewerPlayerId) ?? this.restartFoodDelta(viewerPlayerId);
    const food = this.broadcastFood ?? positionMotes(this.world.food);
    return this.membersFor(viewerPlayerId, snapshot, tracker, food);
  }

  /**
   * A fresh delta reports every mote in the area as spawned: the `game_state`'s whole food for this viewer. A
   * `game_state` can go out between broadcasts, so the food is quantised afresh.
   */
  serializeFull(viewerPlayerId: PlayerId, snapshot: GameSnapshot): ViewerSnapshotMembers {
    const tracker = this.restartFoodDelta(viewerPlayerId);
    return this.membersFor(viewerPlayerId, snapshot, tracker, positionMotes(this.world.food));
  }

  /** A player left the room: its camera and its delta go with it. */
  forget(viewerPlayerId: PlayerId): void {
    this.cameras.forget(viewerPlayerId);
    this.foodDeltas.delete(viewerPlayerId);
  }

  private restartFoodDelta(viewerPlayerId: PlayerId): FoodDeltaTracker {
    const tracker = new FoodDeltaTracker();
    this.foodDeltas.set(viewerPlayerId, tracker);
    return tracker;
  }

  private membersFor(
    viewerPlayerId: PlayerId,
    snapshot: GameSnapshot,
    tracker: FoodDeltaTracker,
    positionedFood: readonly PositionedMote[],
  ): ViewerSnapshotMembers {
    const area = this.cameras.areaOf(this.world, viewerPlayerId);
    const food: FoodDelta = tracker.diffPositioned(foodInArea(positionedFood, area));
    return {
      food,
      dnaFragments: snapshot.dnaFragments.filter((fragment) => isInInterestArea(area, fragment.x, fragment.y)),
      ownProgress: ownProgressOf(this.world, viewerPlayerId),
      appliedInputSequenceByPlayer: ownSequenceOf(snapshot, viewerPlayerId),
    };
  }
}
