// The server records (docs/architecture/entity-model.md §2): supersets of the wire views. `serialize.ts`
// projects them onto views; nothing outside `game/` reads a record.

import type {
  BacteriumVariant,
  CellModifiers,
  CellView,
  DnaFragmentView,
  DnaTag,
  EngulfReleaseReason,
  EntityId,
  FoodMoteView,
  GameInput,
  GiantSpecies,
  PlayerId,
  PlayerProgressView,
  PoolCreatureCellSpecies,
  SteerCommand,
  TraitOfferView,
} from '@evolution/shared';

/**
 * One predator's memory of a prey it spat out (docs/ecology/absorption.md §6.1): it cannot restart on that
 * prey until `untilTick`, and separation pushes the pair apart meanwhile (§5.3). One entry per
 * spat-out prey, in the order they were spat out; expired entries are pruned by the engulf step. The arm's
 * re-grab cooldown (#735) keeps the same record: an amoeba cannot grab that prey by the arm until `untilTick`.
 */
export interface SpitOutRefractoryRecord {
  preyCellId: EntityId;
  untilTick: number;
}

/**
 * The release a debug reader needs to tell `escaped` from `ratio` from `aborted` (docs/ARCHITECTURE.md
 * §8): `cell_released` rides the delta broadcast alone, which no debug tool drains.
 */
export interface EngulfReleaseRecord {
  reason: EngulfReleaseReason;
  tick: number;
  predatorCellId: EntityId;
}

/** A bacterium mote's record: the only food a latch takes, so its variant is always set. */
export type BacteriumMoteRecord = FoodMoteRecord & { bacteriumVariant: BacteriumVariant };

/**
 * One bacterium a player cell holds on its rim (docs/game-design/early-life.md §15.4.1): the mote's own record, kept
 * untouched from the catch (its id, mass, DNA, tag and heading), so a bond eats it through `eatFoodMote` and a shake
 * puts it back into the world at its rim point under a fresh id, its mass, DNA, tag and heading kept (§15.4.2); plus its bearing from the cell's centre at the catch and the catch's tick.
 * `serialize.ts` projects it onto the wire's `LatchedBacteriumView`.
 */
export interface LatchedBacteriumRecord {
  mote: BacteriumMoteRecord;
  bearingRadians: number;
  caughtAtTick: number;
}

/** The view's fields the record holds in a richer form: `latchedBacteria` keeps each held mote's whole record. */
type CellViewFieldsKeptRicher = 'latchedBacteria';

export interface CellRecord extends Omit<CellView, CellViewFieldsKeptRicher> {
  /** The held list (early-life.md §15.4), in catch order; empty for every cell that does not latch. In the state hash. */
  latchedBacteria: LatchedBacteriumRecord[];
  /**
   * The latest applied input, latched until replaced. `null` until the player's first input (a spawn,
   * a respawn, a fixture placement): no target, throttle 0 (docs/ecology/mass-and-movement.md §5.2).
   */
  targetX: number | null;
  targetY: number | null;
  /** Folded at step 1 of the tick (docs/traits/model.md §2); the simulation reads only this. */
  modifiers: CellModifiers;
  /**
   * A fixture pin (docs/ecology/acceptance.md §8): the centre is restored after the movement step every
   * tick. `null` in play; only the scenario adapter sets it.
   */
  pinnedX: number | null;
  pinnedY: number | null;
  /**
   * A sealed prey rides its predator (docs/ecology/absorption.md §6.1, the seal row): its centre is the
   * predator's plus this offset after the predator has moved. `null` whenever it is not carried.
   */
  carriedOffsetX: number | null;
  carriedOffsetY: number | null;
  /**
   * How far the engulf hold moved this prey this tick outside the movement kernel (wu): the drag (#772) and the arm's
   * pull (#735). Cleared at the top of step 6 and read only by the serializer, which reports it in the view's velocity
   * (#774); the kernel never reads it, so the prey's own velocity, and the physics, stay as they were.
   */
  heldDisplacementX: number;
  heldDisplacementY: number;
  /** This cell's spit-out memories as a predator; empty for everything that never spat anything out. */
  spitOutRefractories: SpitOutRefractoryRecord[];
  /** This cell's arm re-grab cooldowns as a predator (#735): the prey it may not grab by the arm alone yet. */
  armRegrabRefractories: SpitOutRefractoryRecord[];
  /**
   * This tick's steer command, taken from the start-of-tick pose at the top of the movement step
   * and kept so the engulf struggle reads the command the movement actually used, not a second one
   * taken after the cell has moved (docs/ecology/mass-and-movement.md §5.2, docs/ecology/absorption.md §6.1).
   */
  steerCommand: SteerCommand;
  /** The last engulf this cell was released from, as prey; `null` until one ends (docs/ecology/absorption.md §6.1). */
  lastRelease: EngulfReleaseRecord | null;
}

/** A cell a player owns: `playerId` narrowed from the view's `PlayerId | null` (a wild cell has none). */
export type PlayerCellRecord = CellRecord & { playerId: PlayerId };

export function isPlayerCell(cell: CellRecord): cell is PlayerCellRecord {
  return cell.playerId !== null;
}

/**
 * What every seat's mind reads (docs/architecture/entity-model.md §2, docs/ecology/giants.md §3.5.15): the base of the
 * wild seat and the giant seat. `cellId` is null while the seat waits out `respawnInTicks`. `grownMass` is the growth
 * above the seat's base size and `fullMass` the last settle's full size, so the wound is `cell.mass − fullMass` and is
 * never stored (`wild/wild-settle.ts`). The heading and `decideInTicks` rest at 0 until a mind drives them.
 */
export interface SeatMindRecord {
  seatNumber: number;
  cellId: EntityId | null;
  grownMass: number;
  fullMass: number;
  respawnInTicks: number;
  headingX: number;
  headingY: number;
  decideInTicks: number;
  /** The cell the last decision hunts, re-aimed at every tick (`wild/wild-hunt-aim.ts`); `null` for any other rule. */
  huntPreyId: EntityId | null;
  /** The tick the hunt on `huntPreyId` began (`wild/wild-hunt-give-up.ts`); meaningless while it is `null`. */
  huntStartTick: number;
  /** The last prey this seat gave up on, left out of its hunts until it gives up on another; `null` for none. */
  givenUpPreyId: EntityId | null;
  /** The seat hunts nothing before this tick: the rest after a give-up (`wild/wild-hunt-give-up.ts`). */
  huntRestUntilTick: number;
}

/**
 * A wild seat (docs/ecology/wild-cells.md §3.3, docs/architecture/entity-model.md §2): the whole of a wild cell's
 * memory, filled at world creation (`wild/wild-seats.ts`). The base size is `worldMass × sizeFactor`.
 */
export interface WildSeatRecord extends SeatMindRecord {
  sizeFactor: number;
  /** The die-off's starver (docs/ecology/wild-cells.md §3.3.6): committed until its cell dies. */
  isStarving: boolean;
}

/**
 * A giant seat (docs/ecology/giants.md §3.5.9, §3.5.15): one per species, numbered `WILD_CELL_COUNT` + the species'
 * place in `GIANT_SPECIES_ORDER` (`wild/giant-seats.ts`). The base size is `bornMass`, drawn once per life; a giant is
 * outside the die-off (§3.5.10), so it has no size factor and never starves.
 */
export interface GiantSeatRecord extends SeatMindRecord {
  species: GiantSpecies;
  bornMass: number;
}

/**
 * A pool creature's seat (docs/game-design/phases.md §14.6, docs/architecture/entity-model.md §2): the whole of a
 * creature's memory, a seat with a mind built the way a giant's is (its own seat list, `WorldState.poolCreatureSeats`,
 * numbered after the giants' seats by `poolCreatureSeatNumber`, and the seats' respawn). Its cell's `poolCreature` view
 * mirrors `species`, `isLandmark` and the mind's heading as an angle (`mirrorPoolCreatureSeat`), so the seat, hashed in
 * the eras' section, is the one home of each. The copepod has no seat: its pass is `WorldState.copepodLane`.
 */
export interface PoolCreatureSeatRecord extends SeatMindRecord {
  species: PoolCreatureCellSpecies;
  isLandmark: boolean;
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
  /** FIFO; `offerQueue[0]` is the shown offer once `shownAtTick` is set (docs/PROGRESSION.md §4). */
  offerQueue: TraitOffer[];
  nextOfferId: number;
  /** Echoed in the snapshot for prediction (docs/architecture/client.md §5). */
  appliedInputSequence: number;
  /** Coalesced by `submitInput` (docs/architecture/server-simulation.md §3.2). */
  pendingInput: GameInput | null;
}

export interface FoodMoteRecord extends FoodMoteView {
  /** docs/ecology/food-and-spawn.md §1 by kind. */
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

/** A fractional spawner accumulator (docs/ecology/food-and-spawn.md §3) plus what the scenarios count. */
export interface SpawnerState {
  accumulator: number;
  /** Entities this spawner has spawned since the world was created (E2, E14 count spawns, not populations). */
  spawnedCount: number;
  /** Placed scenarios switch the spawners off (docs/ecology/acceptance.md §8). */
  isEnabled: boolean;
}

export type BacteriaCounters = Record<BacteriumVariant, number>;
