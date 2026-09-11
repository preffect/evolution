// Server effects into cell clips (docs/RENDERING.md §4): an eat starts the eat clip and aims its
// dimple at the mote, a level-up its burst, a respawn its fade-in; an absorption starts a ghost
// from the prey's last view. Pure over the registry and the ghosts.

import { EFFECT_KIND, MOTION_CLIPS, type EntityId, type GameEffect } from '@evolution/shared';
import type { ViewRegistry } from '../view-registry';
import type { CellView } from '@evolution/shared';
import type { CellRenderState } from './cell-render-state';
import type { GhostRegistry } from './ghost-cells';

function absorbed(
  effect: Extract<GameEffect, { kind: typeof EFFECT_KIND.cellAbsorbed }>,
  registry: ViewRegistry<CellView, CellRenderState>,
  ghosts: GhostRegistry,
  nowMs: number,
): void {
  const lastView = registry.get(effect.cellId)?.lastView;
  if (lastView !== undefined && lastView !== null) ghosts.add(lastView, effect.predatorCellId, nowMs);
}

export function applyCellEffects(
  effects: readonly GameEffect[],
  registry: ViewRegistry<CellView, CellRenderState>,
  ghosts: GhostRegistry,
  nowMs: number,
): void {
  for (const effect of effects) {
    if (effect.kind === EFFECT_KIND.cellAbsorbed) {
      absorbed(effect, registry, ghosts, nowMs);
      continue;
    }
    if (effect.kind === EFFECT_KIND.worldLevelUp) continue;
    const state = registry.get(effect.cellId as EntityId);
    if (state === undefined) continue;
    if (effect.kind === EFFECT_KIND.eat) {
      const view = state.lastView;
      state.angles.moteAngle = view === null ? null : Math.atan2(effect.y - view.y, effect.x - view.x);
      state.clips.play(MOTION_CLIPS.eat, nowMs);
    } else if (effect.kind === EFFECT_KIND.levelUp) {
      state.clips.play(MOTION_CLIPS.level_up, nowMs);
    } else {
      state.clips.play(MOTION_CLIPS.respawn, nowMs);
    }
  }
}
