// What each viewer alone is sent of a snapshot (docs/architecture/wire-contract.md §4.1, §4.2 lever 1): its own
// progress, its own applied input sequence, and the food and DNA fragments inside its interest area. The food is a
// delta per viewer: a mote entering the area is `spawned` for that viewer, one leaving it is in `removedIds`, and one
// inside it that moved is in `moved`. A `game_state` restarts that delta from the motes it carries. Every member is
// read from the world: the broadcast builds none of them (#399), and the full snapshot keeps every mote and fragment
// for no viewer (a debug read, a scenario).

import {
  interestMarginFor,
  type DnaFragmentView,
  type FoodDelta,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
import type { ViewerStateSerializer } from '../game-module.js';
import { findPlayer } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import { FoodDeltaTracker, MoteMotion, type MoteEntry, type PositionedFood } from './food-delta-tracker.js';
import { isInInterestArea, type InterestArea } from './interest-area.js';
import { MASS_WINDOW, ownProgressOf, toDnaFragmentView } from './serialize.js';
import { ViewerCameras } from './viewer-cameras.js';
import { ViewerMemberJson } from './viewer-member-json.js';
import {
  VIEWER_SNAPSHOT_KEYS,
  type BroadcastSnapshot,
  type ViewerSnapshotKey,
  type ViewerSnapshotMembers,
} from './viewer-snapshot-keys.js';

/** What every viewer of one snapshot reads of the world: its food and fragments quantised once, and the live margin. */
interface WorldReading {
  readonly food: PositionedFood;
  readonly fragments: readonly DnaFragmentView[];
  readonly marginWu: number;
}

/** The broadcast the reading was taken for. */
interface ObservedBroadcast extends WorldReading {
  readonly broadcast: BroadcastSnapshot;
}

function foodInArea(food: readonly MoteEntry[], area: InterestArea): MoteEntry[] {
  return food.filter(({ position }) => isInInterestArea(area, position.x, position.y));
}

/** The viewer's own entry of the applied input sequences: the only one its prediction reads. */
function ownSequenceOf(world: WorldState, viewerPlayerId: PlayerId): Record<string, number> {
  const viewer = findPlayer(world, viewerPlayerId);
  return viewer === undefined ? {} : { [viewerPlayerId]: viewer.appliedInputSequence };
}

export class EvolutionViewerState implements ViewerStateSerializer<GameSnapshot, ViewerSnapshotKey> {
  readonly keys = VIEWER_SNAPSHOT_KEYS;
  private readonly cameras = new ViewerCameras();
  private readonly foodDeltas = new Map<PlayerId, FoodDeltaTracker>();
  /** Each viewer's slot in the mote entries (`FoodDeltaTracker`): kept across a restart, freed when it leaves. */
  private readonly slots = new Map<PlayerId, number>();
  private readonly freeSlots: number[] = [];
  private nextSlot = 0;
  private readonly motion = new MoteMotion();
  private readonly json = new ViewerMemberJson();
  private observed: ObservedBroadcast | null = null;

  constructor(private readonly world: WorldState) {}

  serialize(viewerPlayerId: PlayerId, broadcast: BroadcastSnapshot): ViewerSnapshotMembers {
    const reading = this.observe(broadcast);
    const tracker = this.foodDeltas.get(viewerPlayerId) ?? this.restartFoodDelta(viewerPlayerId);
    return this.membersFor(viewerPlayerId, tracker, reading);
  }

  /**
   * A fresh delta reports every mote in the area as spawned: the `game_state`'s whole food for this viewer. A
   * `game_state` can go out between broadcasts, so the world is read afresh and no camera steps. Like its empty
   * effects, it carries no sprint window: that window was the last broadcast's.
   */
  serializeFull(viewerPlayerId: PlayerId): ViewerSnapshotMembers {
    const members = this.membersFor(viewerPlayerId, this.restartFoodDelta(viewerPlayerId), this.readWorld());
    return { ...members, ownProgress: ownProgressOf(this.world, viewerPlayerId, MASS_WINDOW.omitted) };
  }

  /** `JSON.stringify(value)` for one member, the items every viewer shares stringified once per broadcast (#406). */
  memberJson(key: ViewerSnapshotKey, value: unknown): string {
    return this.json.memberJson(key, value);
  }

  /** A player left the room: its camera and its delta go with it. */
  forget(viewerPlayerId: PlayerId): void {
    this.cameras.forget(viewerPlayerId);
    this.foodDeltas.delete(viewerPlayerId);
    const slot = this.slots.get(viewerPlayerId);
    if (slot !== undefined) this.freeSlots.push(slot);
    this.slots.delete(viewerPlayerId);
  }

  /**
   * Once per broadcast, on its first viewer, the world is read; on the first broadcast of a tick, every camera steps.
   * A second broadcast of one tick (a paused room republishing a debug change) re-reads the world but steps no camera
   * twice, and a broadcast no viewer was sent is stepped over on the next one, so no caller has to announce either.
   */
  private observe(broadcast: BroadcastSnapshot): WorldReading {
    if (this.observed?.broadcast === broadcast) return this.observed;
    if (this.observed?.broadcast.tick !== broadcast.tick) this.cameras.step(this.world);
    this.observed = { broadcast, ...this.readWorld() };
    return this.observed;
  }

  private readWorld(): WorldReading {
    return {
      food: this.motion.position(this.world.food),
      fragments: this.world.dnaFragments.map((fragment) => toDnaFragmentView(fragment)),
      marginWu: interestMarginFor(this.world.balance),
    };
  }

  private restartFoodDelta(viewerPlayerId: PlayerId): FoodDeltaTracker {
    const tracker = new FoodDeltaTracker(this.slotOf(viewerPlayerId));
    this.foodDeltas.set(viewerPlayerId, tracker);
    return tracker;
  }

  private slotOf(viewerPlayerId: PlayerId): number {
    let slot = this.slots.get(viewerPlayerId);
    if (slot === undefined) {
      slot = this.freeSlots.pop() ?? this.nextSlot++;
      this.slots.set(viewerPlayerId, slot);
    }
    return slot;
  }

  private membersFor(
    viewerPlayerId: PlayerId,
    tracker: FoodDeltaTracker,
    reading: WorldReading,
  ): ViewerSnapshotMembers {
    const area = this.cameras.areaOf(this.world, viewerPlayerId, reading.marginWu);
    const food: FoodDelta = this.json.noteFood(tracker.diff(reading.food, foodInArea(reading.food.motes, area)));
    return {
      food,
      dnaFragments: reading.fragments.filter((fragment) => isInInterestArea(area, fragment.x, fragment.y)),
      ownProgress: ownProgressOf(this.world, viewerPlayerId),
      appliedInputSequenceByPlayer: ownSequenceOf(this.world, viewerPlayerId),
    };
  }
}
