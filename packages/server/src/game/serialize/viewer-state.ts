// What each viewer alone is sent of a snapshot (docs/architecture/wire-contract.md §4.1, §4.2 lever 1): its own
// progress, its own applied input sequence, and the food and DNA fragments inside its interest area. The food is a
// delta per viewer: a mote entering the area is `spawned` for that viewer, one leaving it is in `removedIds`, and one
// inside it that moved is in `moved`. A `game_state` restarts that delta from the motes it carries. The shared
// snapshot keeps every mote and fragment for no viewer (a debug read, a scenario).

import { interestMarginFor, type FoodDelta, type GameSnapshot, type PlayerId } from '@evolution/shared';
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

/** What every viewer of one snapshot reads of the world: its food quantised once, and the live balance's margin. */
interface WorldReading {
  readonly food: readonly PositionedMote[];
  readonly marginWu: number;
}

/** The snapshot the reading was taken for. */
interface ObservedSnapshot extends WorldReading {
  readonly snapshot: GameSnapshot;
}

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
  private observed: ObservedSnapshot | null = null;

  constructor(private readonly world: WorldState) {}

  serialize(viewerPlayerId: PlayerId, snapshot: GameSnapshot): ViewerSnapshotMembers {
    const reading = this.observe(snapshot);
    const tracker = this.foodDeltas.get(viewerPlayerId) ?? this.restartFoodDelta(viewerPlayerId);
    return this.membersFor(viewerPlayerId, snapshot, tracker, reading);
  }

  /**
   * A fresh delta reports every mote in the area as spawned: the `game_state`'s whole food for this viewer. A
   * `game_state` can go out between broadcasts, so the world is read afresh and no camera steps.
   */
  serializeFull(viewerPlayerId: PlayerId, snapshot: GameSnapshot): ViewerSnapshotMembers {
    return this.membersFor(viewerPlayerId, snapshot, this.restartFoodDelta(viewerPlayerId), this.readWorld());
  }

  /** A player left the room: its camera and its delta go with it. */
  forget(viewerPlayerId: PlayerId): void {
    this.cameras.forget(viewerPlayerId);
    this.foodDeltas.delete(viewerPlayerId);
  }

  /**
   * Once per snapshot, on its first viewer, the world is read; on the first snapshot of a tick, every camera steps.
   * A second snapshot of one tick (a paused room republishing a debug change) re-reads the world but steps no camera
   * twice, and a broadcast no viewer was sent is stepped over on the next one, so no caller has to announce either.
   */
  private observe(snapshot: GameSnapshot): WorldReading {
    if (this.observed?.snapshot === snapshot) return this.observed;
    if (this.observed?.snapshot.tick !== snapshot.tick) this.cameras.step(this.world);
    this.observed = { snapshot, ...this.readWorld() };
    return this.observed;
  }

  private readWorld(): WorldReading {
    return { food: positionMotes(this.world.food), marginWu: interestMarginFor(this.world.balance) };
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
    reading: WorldReading,
  ): ViewerSnapshotMembers {
    const area = this.cameras.areaOf(this.world, viewerPlayerId, reading.marginWu);
    const food: FoodDelta = tracker.diffPositioned(foodInArea(reading.food, area));
    return {
      food,
      dnaFragments: snapshot.dnaFragments.filter((fragment) => isInInterestArea(area, fragment.x, fragment.y)),
      ownProgress: ownProgressOf(this.world, viewerPlayerId),
      appliedInputSequenceByPlayer: ownSequenceOf(snapshot, viewerPlayerId),
    };
  }
}
