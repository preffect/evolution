// The server records (docs/ARCHITECTURE.md §2): supersets of the wire views. `serialize.ts`
// projects them onto views; nothing outside `game/evolution/` reads a record.

import type {
  BacteriumVariant,
  CellModifiers,
  CellView,
  DnaFragmentView,
  DnaTag,
  FoodMoteView,
  GameInput,
  OwnedTrait,
  PlayerProgressView,
  TraitOfferView,
} from '@evolution/shared';

export interface CellRecord extends CellView {
  /** The latest applied input, latched until replaced. */
  targetX: number;
  targetY: number;
  /** Folded at step 1 of the tick (docs/TRAITS.md §2); the simulation reads only this. */
  modifiers: CellModifiers;
  /**
   * A fixture pin (docs/ECOLOGY.md §8): the centre is restored after the movement step every
   * tick. `null` in play; only the scenario adapter sets it.
   */
  pinnedX: number | null;
  pinnedY: number | null;
}

export interface TraitOffer extends TraitOfferView {
  /** `null` while queued behind another offer; `cards` and `cardWeights` are empty until shown. */
  shownAtTick: number | null;
  /** For the timeout pick: highest weight, lowest catalog index. */
  cardWeights: number[];
  /** The catalog index of each card, parallel to `cards`, for the timeout tie-break. */
  catalogIndexes: number[];
}

export interface PlayerRecord extends PlayerProgressView {
  avatarIndex: number;
  /** Tie-break for the leaderboard and the input drain order. */
  joinOrder: number;
  /** Survive death; the cell's `traits` mirrors them. */
  ownedTraits: OwnedTrait[];
  /** FIFO; `offerQueue[0]` is the shown offer once `shownAtTick` is set (docs/PROGRESSION.md §4). */
  offerQueue: TraitOffer[];
  nextOfferId: number;
  /** Echoed in the snapshot for prediction (docs/ARCHITECTURE.md §5). */
  appliedInputSequence: number;
  /** Coalesced by `submitInput` (docs/ARCHITECTURE.md §3.2). */
  pendingInput: GameInput | null;
}

export interface FoodMoteRecord extends FoodMoteView {
  /** docs/ECOLOGY.md §1 by kind. */
  mass: number;
  dna: number;
  /** By variant for bacteria, `null` otherwise. */
  tag: DnaTag | null;
  /** Bacteria only: the random walk, redrawn from the `moteMotion` stream. */
  headingRadians: number;
  /** Detritus only. */
  expiresAtTick: number | null;
}

export interface DnaFragmentRecord extends DnaFragmentView {
  /** Unit vector × `DNA_FRAGMENT_DRIFT_SPEED`, drawn at spawn. */
  driftX: number;
  driftY: number;
}

/** A fractional spawner accumulator (docs/ECOLOGY.md §3) plus what the scenarios count. */
export interface SpawnerState {
  accumulator: number;
  /** Entities this spawner has spawned since the world was created (E2, E14 count spawns, not populations). */
  spawnedCount: number;
  /** Placed scenarios switch the spawners off (docs/ECOLOGY.md §8). */
  isEnabled: boolean;
}

export type BacteriaCounters = Record<BacteriumVariant, number>;
