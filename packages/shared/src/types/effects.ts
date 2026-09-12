// Server-owned moments the snapshot carries for the renderer and the sound bus
// (docs/ARCHITECTURE.md §2, §6, §7). An effect is emitted the tick it happens and drained into the
// next broadcast; the client never infers one from state diffs. Names are past tense or the
// moment they mark (`eat`, `level_up`, `respawn`; docs/CODE-STANDARDS.md §6), pinned in game.test.ts.

import type { EntityId, PlayerId, ValueOf } from './common.js';
import type { CellStage, EntityKind } from './game.js';

export const EFFECT_KIND = {
  cellAbsorbed: 'cell_absorbed',
  cellReleased: 'cell_released',
  eat: 'eat',
  levelUp: 'level_up',
  respawn: 'respawn',
  worldLevelUp: 'world_level_up',
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

/** The prey's cell was removed this tick (docs/ECOLOGY.md §6.2); the player is now spectating. */
export interface CellAbsorbedEffect extends EffectBase {
  kind: typeof EFFECT_KIND.cellAbsorbed;
  cellId: EntityId;
  playerId: PlayerId;
  predatorCellId: EntityId;
}

/**
 * Why an engulf ended without a payout (docs/ECOLOGY.md §6.1). Its home is here rather than in
 * `simulation/engulf-eligibility.ts` because the wire carries it: `types` never imports `simulation`
 * (docs/ARCHITECTURE.md §10). `escaped` is contact lost, `spat_out` a spine roll, `ratio` the
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

/** An engulf ended with the prey still alive (docs/ECOLOGY.md §6.1): both cells are free again. */
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

/** The world clock crossed a whole level this tick (docs/ECOLOGY.md §3.1); it happens everywhere, so it carries no position. */
export interface WorldLevelUpEffect extends EffectMoment {
  kind: typeof EFFECT_KIND.worldLevelUp;
  level: number;
  stage: CellStage;
}

export type GameEffect =
  CellAbsorbedEffect | CellReleasedEffect | EatEffect | LevelUpEffect | RespawnEffect | WorldLevelUpEffect;
