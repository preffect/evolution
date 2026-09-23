// The food delta (docs/architecture/wire-contract.md §4, §4.1): static motes ride as spawned / removed deltas
// and the ones that moved (bacteria every tick, attracted motes) as position patches. The
// tracker remembers what its viewer was last sent so the client can apply each delta idempotently
// (upsert spawned, delete-if-present removed, patch moved); a first call reports everything as
// spawned, which is also what a rematch looks like on the wire.
//
// Shared once per broadcast (ticket #406): `MoteMotion` keeps one entry per mote across broadcasts, quantises its
// position, notes the broadcast it last moved at and holds its JSON, so a viewer never compares positions, hashes an
// id or stringifies a mote itself. Per viewer, the tracker owns a slot: an entry records, in that slot, the broadcast
// the viewer was last sent the mote at, and the tracker keeps the list of entries it last sent. A mote in view both
// times is `moved` when it moved after that broadcast, which also covers a viewer that missed broadcasts.

import type { EntityId, FoodDelta, FoodMoteView, MotePositionView } from '@evolution/shared';
import type { FoodMoteRecord } from '../world/entities.js';
import { toFoodMoteView, toMotePositionView } from './serialize.js';

/** One mote as every viewer reads it; the same object from broadcast to broadcast while the mote lives. */
export class MoteEntry {
  mote: FoodMoteRecord;
  /** Its quantised position: the same object until it moves, so its JSON is written once per move. */
  position: MotePositionView;
  /** The `MoteMotion` sequence of the broadcast the quantised position last changed at (or the mote appeared). */
  movedAtSequence: number;
  /** Per viewer slot, the sequence of the broadcast that viewer was last sent this mote at. */
  readonly sentAtBySlot: number[] = [];
  private positionJsonValue: string | null = null;
  private spawnedView: { readonly sequence: number; readonly view: FoodMoteView; json: string | null } | null = null;

  constructor(mote: FoodMoteRecord, position: MotePositionView, sequence: number) {
    this.mote = mote;
    this.position = position;
    this.movedAtSequence = sequence;
  }

  get id(): EntityId {
    return this.mote.id;
  }

  /** `JSON.stringify(position)`, written once per move. */
  get positionJson(): string {
    this.positionJsonValue ??= JSON.stringify(this.position);
    return this.positionJsonValue;
  }

  /** Moves the entry to a new quantised position. */
  moveTo(position: MotePositionView, sequence: number): void {
    this.position = position;
    this.movedAtSequence = sequence;
    this.positionJsonValue = null;
  }

  /** The whole view at `sequence`, built once however many viewers are sent the mote as spawned. */
  spawnedViewAt(sequence: number): FoodMoteView {
    if (this.spawnedView?.sequence !== sequence) {
      this.spawnedView = { sequence, view: toFoodMoteView(this.mote), json: null };
    }
    return this.spawnedView.view;
  }

  /** `JSON.stringify(spawnedViewAt(sequence))`, written once per broadcast. */
  spawnedJsonAt(sequence: number): string {
    const view = this.spawnedViewAt(sequence);
    const cached = this.spawnedView!;
    cached.json ??= JSON.stringify(view);
    return cached.json;
  }
}

/** One broadcast's food as every viewer reads it. */
export interface PositionedFood {
  readonly sequence: number;
  readonly motes: readonly MoteEntry[];
}

/** Quantises every mote once per broadcast and keeps when each one last moved: the part every viewer shares. */
export class MoteMotion {
  private sequence = 0;
  private entries = new Map<EntityId, MoteEntry>();

  /** The next broadcast's food: each mote's entry, moved only when its quantised position changed. */
  position(food: readonly FoodMoteRecord[]): PositionedFood {
    this.sequence += 1;
    const next = new Map<EntityId, MoteEntry>();
    const motes = food.map((mote) => {
      const position = toMotePositionView(mote);
      let entry = this.entries.get(mote.id);
      if (entry === undefined || entry.mote !== mote) {
        entry = new MoteEntry(mote, position, this.sequence);
      } else if (entry.position.x !== position.x || entry.position.y !== position.y) {
        entry.moveTo(position, this.sequence);
      }
      next.set(mote.id, entry);
      return entry;
    });
    this.entries = next;
    return { sequence: this.sequence, motes };
  }
}

/** A viewer's delta with the entries behind it, so its JSON is joined from strings every viewer shares. */
export interface FoodDeltaParts {
  readonly delta: FoodDelta;
  readonly sequence: number;
  readonly spawned: readonly MoteEntry[];
  readonly moved: readonly MoteEntry[];
}

const NEVER_SENT = Number.NEGATIVE_INFINITY;

export class FoodDeltaTracker {
  /** The entries the viewer was last sent, in that broadcast's array order. */
  private sentEntries: MoteEntry[] = [];
  /** Last broadcast's list, emptied and reused as the next one. */
  private spareEntries: MoteEntry[] = [];
  /** The sequence of the food the viewer was last sent. */
  private sentSequence = NEVER_SENT;

  /** `slot` is this viewer's index into every entry's `sentAtBySlot`; no two live trackers share one. */
  constructor(private readonly slot: number) {}

  /** The delta from what the viewer was last sent to `inArea`, the entries of `food` inside its area. */
  diff(food: PositionedFood, inArea: readonly MoteEntry[]): FoodDeltaParts {
    const { slot, sentSequence } = this;
    const nextEntries = this.spareEntries;
    nextEntries.length = 0;
    const spawned: MoteEntry[] = [];
    const moved: MoteEntry[] = [];
    for (const entry of inArea) {
      if (entry.sentAtBySlot[slot] !== sentSequence) spawned.push(entry);
      else if (entry.movedAtSequence > sentSequence) moved.push(entry);
      entry.sentAtBySlot[slot] = food.sequence;
      nextEntries.push(entry);
    }
    const removedIds: EntityId[] = [];
    for (const entry of this.sentEntries) {
      if (entry.sentAtBySlot[slot] !== food.sequence) removedIds.push(entry.id);
    }
    this.spareEntries = this.sentEntries;
    this.sentEntries = nextEntries;
    this.sentSequence = food.sequence;
    const delta: FoodDelta = {
      spawned: spawned.map((entry) => entry.spawnedViewAt(food.sequence)),
      removedIds,
      moved: moved.map((entry) => entry.position),
    };
    return { delta, sequence: food.sequence, spawned, moved };
  }
}
