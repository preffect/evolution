// Server-owned moments the snapshot carries for the renderer and the sound bus
// (docs/architecture/entity-model.md §2, docs/architecture/client.md §6, §7). An effect is emitted the tick it happens and drained into the
// next broadcast; the client never infers one from state diffs. Names are past tense or the
// moment they mark (`eat`, `level_up`, `respawn`; docs/CODE-STANDARDS.md §6), pinned in game.test.ts.

import type { EntityId, PlayerId, ValueOf } from './common.js';
import type { BacteriumVariant, CellStage, EntityKind, GiantSpecies } from './game.js';

export const EFFECT_KIND = {
  cellAbsorbed: 'cell_absorbed',
  cellReleased: 'cell_released',
  eat: 'eat',
  levelUp: 'level_up',
  respawn: 'respawn',
  worldLevelUp: 'world_level_up',
  bacteriumLatched: 'bacterium_latched',
  bacteriumBonded: 'bacterium_bonded',
  latchShaken: 'latch_shaken',
} as const;
export type EffectKind = (typeof EFFECT_KIND)[keyof typeof EFFECT_KIND];

interface EffectMoment {
  kind: EffectKind;
  /** The world tick the effect happened on. */
  tick: number;
}

/** An effect that happened somewhere: the renderer and the sound bus place it. */
interface EffectBase extends EffectMoment {
  x: number;
  y: number;
}

/**
 * The prey's cell was removed this tick (docs/ecology/absorption.md §6.2); a player prey is now spectating. A wild
 * prey (docs/ecology/wild-cells.md §3.3) is reported the same way with `playerId: null`, mirroring `CellView.playerId`
 * (#270): the renderer keys the dissolve, the DNA streams and the ghost on `cellId`, not on the player.
 */
export interface CellAbsorbedEffect extends EffectBase {
  kind: typeof EFFECT_KIND.cellAbsorbed;
  cellId: EntityId;
  /** The prey's player; `null` for a wild prey, as on its `CellView`. */
  playerId: PlayerId | null;
  predatorCellId: EntityId;
  /** Mass the predator's payout added, measured around `gainMass` (0 for a wild predator); `SNAPSHOT_MASS_DECIMALS` on the wire. */
  predatorMassGained: number;
  /** DNA the payout added to the predator's player, the cap overflow included; `SNAPSHOT_MASS_DECIMALS` on the wire. */
  predatorDnaGained: number;
  /** The prey's `giantSpecies`: the client's giant popup reads it (docs/ecology/giants.md §3.5.8); null for any other prey. */
  preyGiantSpecies: GiantSpecies | null;
}

/**
 * Why an engulf ended without a payout (docs/ecology/absorption.md §6.1). Its home is here rather than in
 * `simulation/engulf-eligibility.ts` because the wire carries it: `types` never imports `simulation`
 * (docs/architecture/constants-files-tests.md §10). `escaped` is contact lost, `spat_out` a spine roll, `ratio` the
 * predator falling under `ENGULF_RELEASE_RATIO`, `aborted` the world taking the pair apart (a chain
 * payout, a removed cell, the results phase).
 */
export const ENGULF_RELEASE_REASON = {
  escaped: 'escaped',
  spatOut: 'spat_out',
  ratio: 'ratio',
  aborted: 'aborted',
} as const;
export type EngulfReleaseReason = ValueOf<typeof ENGULF_RELEASE_REASON>;

/** An engulf ended with the prey still alive (docs/ecology/absorption.md §6.1): both cells are free again. */
export interface CellReleasedEffect extends EffectBase {
  kind: typeof EFFECT_KIND.cellReleased;
  cellId: EntityId;
  predatorCellId: EntityId;
  reason: EngulfReleaseReason;
}

/** A mote or a DNA fragment was eaten. */
export interface EatEffect extends EffectBase {
  kind: typeof EFFECT_KIND.eat;
  cellId: EntityId;
  eatenId: EntityId;
  eatenKind: EntityKind;
  /** Mass the eater gained, measured around `gainMass` (digestion bonus in, cap overflow out); `SNAPSHOT_MASS_DECIMALS` on the wire. */
  massGained: number;
  /** DNA the eater's player gained, the cap overflow included; `SNAPSHOT_MASS_DECIMALS` on the wire. */
  dnaGained: number;
}

export interface LevelUpEffect extends EffectBase {
  kind: typeof EFFECT_KIND.levelUp;
  cellId: EntityId;
  playerId: PlayerId;
  level: number;
}

/** A new cell was placed for a player who was spectating. */
export interface RespawnEffect extends EffectBase {
  kind: typeof EFFECT_KIND.respawn;
  cellId: EntityId;
  playerId: PlayerId;
}

/** The world clock crossed a whole level this tick (docs/ecology/food-and-spawn.md §3.1); it happens everywhere, so it carries no position. */
export interface WorldLevelUpEffect extends EffectMoment {
  kind: typeof EFFECT_KIND.worldLevelUp;
  level: number;
  stage: CellStage;
}

/**
 * A cell latched a bacterium (docs/game-design/early-life.md §15.4.1): the mote left the world for the cell's held
 * list. Placed at the mote's centre at the catch; keyed by the mote's id, so the renderer knows which rod.
 */
export interface BacteriumLatchedEffect extends EffectBase {
  kind: typeof EFFECT_KIND.bacteriumLatched;
  cellId: EntityId;
  moteId: EntityId;
  variant: BacteriumVariant;
}

/**
 * A held bacterium bonded (early-life.md §15.4.1): emitted beside the ordinary `eat` of the same mote, which carries
 * the payout. `isCredited` says whether the bond counted toward its variant's endosymbiont. Placed at the rim point.
 */
export interface BacteriumBondedEffect extends EffectBase {
  kind: typeof EFFECT_KIND.bacteriumBonded;
  cellId: EntityId;
  moteId: EntityId;
  isCredited: boolean;
}

/**
 * A sprint shook every held bacterium loose (early-life.md §15.4.2): the motes are free in the world again, under
 * fresh entity ids; `moteIds` are the ids they were held under, the ones the renderer drew. Placed at the cell's centre.
 */
export interface LatchShakenEffect extends EffectBase {
  kind: typeof EFFECT_KIND.latchShaken;
  cellId: EntityId;
  moteIds: EntityId[];
}

export type GameEffect =
  | CellAbsorbedEffect
  | CellReleasedEffect
  | EatEffect
  | LevelUpEffect
  | RespawnEffect
  | WorldLevelUpEffect
  | BacteriumLatchedEffect
  | BacteriumBondedEffect
  | LatchShakenEffect;
