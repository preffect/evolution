// The bench scene's effect schedule (docs/RENDERING.md §7): eats on every snapshot, a level-up on
// its cadence, and the victims' absorb and respawn at the middle and the end of every absorb
// cycle, so every clip of §4 plays in a bench run.

import { EFFECT_KIND, ENTITY_KIND, entityId, type CellView, type GameEffect } from '@evolution/shared';
import {
  RENDER_BENCH_ABSORB_EVERY_TICKS,
  RENDER_BENCH_EATS_PER_SNAPSHOT,
  RENDER_BENCH_LEVEL_UP_EVERY_TICKS,
} from '../constants';
import { BENCH_OWN_PLAYER_ID, benchCellView, victimAbsorbTick, type BenchWorld } from './bench-scene';

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
  if (cell?.playerId === null || cell === undefined) return [];
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

function victimEffects(world: BenchWorld, cells: readonly CellView[], tick: number): GameEffect[] {
  const cycleTick = tick % RENDER_BENCH_ABSORB_EVERY_TICKS;
  const isAbsorbTick = cycleTick === victimAbsorbTick();
  if (!isAbsorbTick && cycleTick !== 0) return [];
  const predatorCellId = cells[0]?.id;
  return world.cells
    .filter((spec) => spec.isVictim)
    .map((spec) => {
      const view = benchCellView(world, spec, tick);
      const owner = spec.playerId ?? BENCH_OWN_PLAYER_ID;
      const base = { tick, x: view.x, y: view.y, cellId: view.id, playerId: owner };
      return isAbsorbTick
        ? { kind: EFFECT_KIND.cellAbsorbed, ...base, predatorCellId: predatorCellId ?? view.id }
        : { kind: EFFECT_KIND.respawn, ...base };
    });
}

export function scheduledBenchEffects(world: BenchWorld, cells: readonly CellView[], tick: number): GameEffect[] {
  return [...eatEffects(cells, tick), ...levelUpEffects(cells, tick), ...victimEffects(world, cells, tick)];
}
