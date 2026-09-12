// The bench scene's effect schedule (docs/RENDERING.md §7): eats on every snapshot, a level-up on
// its cadence, and the victims' absorb and respawn at the middle and the end of every absorb
// cycle, so every clip of §4 plays in a bench run.

import { EFFECT_KIND, ENTITY_KIND, entityId, type CellView, type GameEffect, type PlayerId } from '@evolution/shared';
import {
  RENDER_BENCH_ABSORB_EVERY_TICKS,
  RENDER_BENCH_EATS_PER_SNAPSHOT,
  RENDER_BENCH_LEVEL_UP_EVERY_TICKS,
} from '../constants';
import { HALF } from '../geometry';

/** Victims are on screen for the first half of every absorb cycle, absorbed at its middle and respawned at its end. */
export function isVictimVisible(tick: number): boolean {
  return (tick % RENDER_BENCH_ABSORB_EVERY_TICKS) / RENDER_BENCH_ABSORB_EVERY_TICKS < HALF;
}

export function victimAbsorbTick(): number {
  return Math.floor(RENDER_BENCH_ABSORB_EVERY_TICKS * HALF);
}

function eatEffects(cells: readonly CellView[], tick: number): GameEffect[] {
  const effects: GameEffect[] = [];
  for (let eat = 0; eat < RENDER_BENCH_EATS_PER_SNAPSHOT; eat += 1) {
    const cell = cells[(tick + eat * eat) % cells.length];
    if (cell === undefined) continue;
    effects.push({
      kind: EFFECT_KIND.eat,
      tick,
      x: cell.x + cell.radius,
      y: cell.y,
      cellId: cell.id,
      eatenId: entityId(`bench-m-${eat}`),
      eatenKind: ENTITY_KIND.foodMote,
    });
  }
  return effects;
}

function levelUpEffects(cells: readonly CellView[], tick: number): GameEffect[] {
  if (tick % RENDER_BENCH_LEVEL_UP_EVERY_TICKS !== 0) return [];
  const cell = cells[(tick / RENDER_BENCH_LEVEL_UP_EVERY_TICKS) % cells.length];
  if (cell === undefined || cell.playerId === null) return [];
  return [
    {
      kind: EFFECT_KIND.levelUp,
      tick,
      x: cell.x,
      y: cell.y,
      cellId: cell.id,
      playerId: cell.playerId,
      level: cell.level + 1,
    },
  ];
}

/** The victims dissolve toward the first cell and respawn; a wild victim is credited to `creditedPlayerId`. */
function victimEffects(inputs: BenchEffectInputs, tick: number): GameEffect[] {
  const cycleTick = tick % RENDER_BENCH_ABSORB_EVERY_TICKS;
  const isAbsorbTick = cycleTick === victimAbsorbTick();
  if (!isAbsorbTick && cycleTick !== 0) return [];
  const predator = inputs.cells[0];
  return inputs.victims.map((view) => {
    const base = { tick, x: view.x, y: view.y, cellId: view.id, playerId: view.playerId ?? inputs.creditedPlayerId };
    return isAbsorbTick
      ? { kind: EFFECT_KIND.cellAbsorbed, ...base, predatorCellId: predator?.id ?? view.id }
      : { kind: EFFECT_KIND.respawn, ...base };
  });
}

export interface BenchEffectInputs {
  /** The cells present at the tick, in index order. */
  readonly cells: readonly CellView[];
  /** The victims' views at the tick, whether or not they are present. */
  readonly victims: readonly CellView[];
  /** The player a wild victim's absorb and respawn are credited to. */
  readonly creditedPlayerId: PlayerId;
}

export function scheduledBenchEffects(inputs: BenchEffectInputs, tick: number): GameEffect[] {
  return [...eatEffects(inputs.cells, tick), ...levelUpEffects(inputs.cells, tick), ...victimEffects(inputs, tick)];
}
