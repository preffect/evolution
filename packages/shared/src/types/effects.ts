// Server-owned moments the snapshot carries for the renderer and the sound bus
// (docs/ARCHITECTURE.md §2, §6, §7). An effect is emitted the tick it happens and drained into the
// next broadcast; the client never infers one from state diffs. Names are past tense
// (docs/CODE-STANDARDS.md §6).

import type { EntityId, PlayerId } from './common.js';
import type { EntityKind } from './game.js';

export const EFFECT_KIND = {
  cellAbsorbed: 'cell_absorbed',
  eat: 'eat',
  levelUp: 'level_up',
  respawn: 'respawn',
} as const;
export type EffectKind = (typeof EFFECT_KIND)[keyof typeof EFFECT_KIND];

interface EffectBase {
  kind: EffectKind;
  /** The world tick the effect happened on. */
  tick: number;
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

export type GameEffect = CellAbsorbedEffect | EatEffect | LevelUpEffect | RespawnEffect;
