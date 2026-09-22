// The bench scene's effect schedule (docs/rendering/budget.md §7): eats on every snapshot, a level-up on
// its cadence, and the victims' absorb and respawn at the middle and the end of every absorb
// cycle, so every clip of §4 plays in a bench run.

import { EFFECT_KIND, ENTITY_KIND, entityId, type CellView, type GameEffect } from '@evolution/shared';
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

/** The bench draws no floaters (#385 reads the amounts), so its absorbs pay nothing. */
const NO_BENCH_PAYOUT = { predatorMassGained: 0, predatorDnaGained: 0 } as const;

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
      massGained: 0,
      dnaGained: 0,
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

/**
 * The victims dissolve toward the first cell and respawn. The absorb names the victim's player, `null` for a wild
 * cell (#270); only a player's cell comes back with a `respawn` effect (a wild seat reappears without one,
 * docs/ecology/wild-cells.md §3.3), which is why the bench's victims are player cells.
 */
function victimEffects(inputs: BenchEffectInputs, tick: number): GameEffect[] {
  const cycleTick = tick % RENDER_BENCH_ABSORB_EVERY_TICKS;
  const isAbsorbTick = cycleTick === victimAbsorbTick();
  if (!isAbsorbTick && cycleTick !== 0) return [];
  const predator = inputs.cells[0];
  return inputs.victims.flatMap((view): GameEffect[] => {
    const base = { tick, x: view.x, y: view.y, cellId: view.id };
    if (isAbsorbTick) {
      const predatorCellId = predator?.id ?? view.id;
      return [{ kind: EFFECT_KIND.cellAbsorbed, ...base, playerId: view.playerId, predatorCellId, ...NO_BENCH_PAYOUT }];
    }
    return view.playerId === null ? [] : [{ kind: EFFECT_KIND.respawn, ...base, playerId: view.playerId }];
  });
}

export interface BenchEffectInputs {
  /** The cells present at the tick, in index order. */
  readonly cells: readonly CellView[];
  /** The victims' views at the tick, whether or not they are present. */
  readonly victims: readonly CellView[];
}

export function scheduledBenchEffects(inputs: BenchEffectInputs, tick: number): GameEffect[] {
  return [...eatEffects(inputs.cells, tick), ...levelUpEffects(inputs.cells, tick), ...victimEffects(inputs, tick)];
}
