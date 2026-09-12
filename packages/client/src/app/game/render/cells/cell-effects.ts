// Server effects into the cell layer (docs/RENDERING.md §4): a `cell_absorbed` starts a ghost
// from the prey's last view; an eat, level-up or respawn names the clip its cell plays and, for
// the eat, where the mote was. Pure over the effects and a lookup of last views; the ghosts are
// wired here (#216), the clip starts are the hook slice C (#207) drives with its player.

import {
  EFFECT_KIND,
  MOTION_CLIP,
  type CellView,
  type EntityId,
  type GameEffect,
  type MotionClipId,
} from '@evolution/shared';
import type { GhostRegistry } from './ghost-cells';

/** One clip to start on one cell, aimed at the effect's position when the clip has a direction. */
export interface CellClipStart {
  readonly cellId: EntityId;
  readonly clipId: MotionClipId;
  /** The angle from the cell to the effect (cell frame, radians); `null` when the cell's view is unknown or the clip has no aim. */
  readonly angle: number | null;
}

export type LastViewOf = (cellId: EntityId) => CellView | undefined;

const CLIP_BY_EFFECT: Readonly<Partial<Record<GameEffect['kind'], MotionClipId>>> = {
  [EFFECT_KIND.eat]: MOTION_CLIP.eat,
  [EFFECT_KIND.levelUp]: MOTION_CLIP.levelUp,
  [EFFECT_KIND.respawn]: MOTION_CLIP.respawn,
};

/** The clip starts the frame's effects ask for, in effect order; world-level effects start nothing. */
export function cellClipStarts(effects: readonly GameEffect[], lastViewOf: LastViewOf): CellClipStart[] {
  const starts: CellClipStart[] = [];
  for (const effect of effects) {
    const clipId = CLIP_BY_EFFECT[effect.kind];
    if (clipId === undefined || !('cellId' in effect)) continue;
    const view = lastViewOf(effect.cellId);
    const isAimed = effect.kind === EFFECT_KIND.eat && view !== undefined;
    starts.push({
      cellId: effect.cellId,
      clipId,
      angle: isAimed ? Math.atan2(effect.y - view.y, effect.x - view.x) : null,
    });
  }
  return starts;
}

/** Starts a ghost for every `cell_absorbed` whose prey was drawn last frame. */
export function startAbsorbedGhosts(
  effects: readonly GameEffect[],
  lastViewOf: LastViewOf,
  ghosts: GhostRegistry,
  nowMs: number,
): number {
  let started = 0;
  for (const effect of effects) {
    if (effect.kind !== EFFECT_KIND.cellAbsorbed) continue;
    const prey = lastViewOf(effect.cellId);
    const predator = lastViewOf(effect.predatorCellId);
    if (prey === undefined) continue;
    ghosts.add(prey, predator ?? { id: effect.predatorCellId, x: effect.x, y: effect.y }, nowMs);
    started += 1;
  }
  return started;
}
