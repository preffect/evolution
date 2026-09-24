// docs/ecology/acceptance.md §8.1, the die-off rows (W15, W16), each run twice and hash-compared: over the dish's
// budget the heaviest wild cell starves, one at a time and committed until it bursts into a feast, and its
// seat respawns like an eaten one (docs/ecology/wild-cells.md §3.3.6). The "no player" rows keep the one player idle
// at the far side of the dish; placing it vacates the seeded seats and switches the spawns off.

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE, DNA_TAGS, TICK_INTERVAL_S, type Vec2 } from '@evolution/shared';
import { progressOf, wildCellOf, wildSeatOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { detritusInDish } from './engulf-setups.js';
import { placedSolo } from './shared-setups.js';
import { PLACED_SEAT, WILD_RESPAWN_TICKS, worldMassAtTick } from './wild-setups.js';

const { growth, wildCells } = DEFAULT_BALANCE;
const ONE_TICK = 1;
const MASS_TOLERANCE = 0.01;
const FAR_SIDE: Vec2 = { x: -BROTH_POINT.x, y: 0 };
/** One tick of starvation: 1 − 1/600 of the full size is left. */
const LEFT_PER_TICK = 1 - wildCells.WILD_CELL_STARVATION_FRACTION_PER_SECOND * TICK_INTERVAL_S;
/** W15: seat 0 at size 40 (800 at tick 0, over the 720 budget), alone; read after 1, 600, the burst and the respawn. */
const W15_SIZE = 40;
const W15_READ_TICK = 600;
const W15_BURST_TICK = 2628;
const W15_RESPAWN_TICK = W15_BURST_TICK + WILD_RESPAWN_TICKS + ONE_TICK;
/** The feast: "detritus floor(0.8 × 31.85 / 2) = 12 motes = 24 mass" (the §1 scraps would be 6). */
const W15_FEAST_MASS = 24;
/**
 * W16: seat 0 at size 20 and seat 1 at 19.9 (798 > 720): seat 0 starves and falls below seat 1 within 4 ticks, while
 * the total stays over the budget until tick 131, so a second starver would be chosen without the one-at-a-time rule.
 * The variant's seat 1 at 15 (700 < 720).
 */
const W16_HEAVY_SIZE = 20;
const W16_OVER_SIZE = 19.9;
const W16_UNDER_SIZE = 15;
const W16_SECOND_SEAT = 1;
const W16_READ_TICK = 60;
const W16_VARIANT_TICKS = 600;
const W16_SECOND_AT: Vec2 = { x: -BROTH_POINT.x, y: BROTH_POINT.x };

const starvingOf = (seat: number) => (view: EvolutionView) => [
  wildSeatOf(view, seat)?.isStarving,
  wildCellOf(view, seat)?.isStarving,
];
const massOfSeat = (seat: number) => (view: EvolutionView) => wildCellOf(view, seat)?.mass;

function wildOnly(name: string) {
  return placedSolo(name).placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: FAR_SIDE });
}

describe('ecology/acceptance.md §8.1: the die-off', () => {
  it('W15: a lone giant over the budget starves, committed, bursts on tick 2 628 into a feast and respawns', async () => {
    await wildOnly('W15')
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: W15_SIZE, at: BROTH_POINT })
      .advance(W15_RESPAWN_TICK)
      .expect('starving after tick 1, on the seat and on the cell view', starvingOf(PLACED_SEAT))
      .atTick(ONE_TICK)
      .toEqual([true, true])
      .expect('mass = 40 × 20.0167 × (1 − 1/600) after tick 1', massOfSeat(PLACED_SEAT))
      .atTick(ONE_TICK)
      .toBeCloseTo(W15_SIZE * worldMassAtTick(ONE_TICK) * LEFT_PER_TICK, MASS_TOLERANCE)
      .expect(
        'the base itself shrinks: sizeFactor 40 × (1 − 1/600)',
        (view) => wildSeatOf(view, PLACED_SEAT)?.sizeFactor,
      )
      .atTick(ONE_TICK)
      .toBeCloseTo(W15_SIZE * LEFT_PER_TICK, MASS_TOLERANCE / 100)
      .expect('mass = 40 × 30 × (1 − 1/600)^600 after tick 600, still starving', massOfSeat(PLACED_SEAT))
      .atTick(W15_READ_TICK)
      .toBeCloseTo(W15_SIZE * worldMassAtTick(W15_READ_TICK) * LEFT_PER_TICK ** W15_READ_TICK, MASS_TOLERANCE)
      .expect('committed although under the budget since tick 64', starvingOf(PLACED_SEAT))
      .atTick(W15_READ_TICK)
      .toEqual([true, true])
      .expect('alive the tick before the burst', (view) => wildSeatOf(view, PLACED_SEAT)?.cellId !== null)
      .atTick(W15_BURST_TICK - ONE_TICK)
      .toBe(true)
      .expect('burst on tick 2 628: no cell, not starving, respawnInTicks 600', (view) => [
        wildSeatOf(view, PLACED_SEAT)?.cellId,
        wildSeatOf(view, PLACED_SEAT)?.isStarving,
        wildSeatOf(view, PLACED_SEAT)?.respawnInTicks,
      ])
      .atTick(W15_BURST_TICK)
      .toEqual([null, false, WILD_RESPAWN_TICKS])
      .expect('a feast of 12 detritus motes = 24 mass, not 3 motes of scraps', detritusInDish)
      .atTick(W15_BURST_TICK)
      .toBe(W15_FEAST_MASS)
      .expect('no DNA, tag points, score or wildAbsorptions to anyone', (view) => {
        const progress = progressOf(view, 0);
        const tags = DNA_TAGS.reduce((sum, tag) => sum + (progress?.dnaTagPoints[tag] ?? 0), 0);
        return [progress?.dnaCumulative, tags, progress?.score, progress?.wildAbsorptions];
      })
      .atTick(W15_BURST_TICK)
      .toEqual([0, 0, 0, 0])
      .expect('alive again on tick 3 229 at its base size, a fresh size in [0.5, 2.0], not starving', (view) => {
        const seat = wildSeatOf(view, PLACED_SEAT);
        const mass = wildCellOf(view, PLACED_SEAT)?.mass;
        return (
          seat !== undefined &&
          !seat.isStarving &&
          seat.sizeFactor >= wildCells.WILD_CELL_SIZE_FACTOR_MIN &&
          seat.sizeFactor <= wildCells.WILD_CELL_SIZE_FACTOR_MAX &&
          mass === seat.fullMass
        );
      })
      .atTick(W15_RESPAWN_TICK)
      .toBe(true)
      .runDeterministic();
  });

  it('W16: the heaviest starves, one at a time; under the budget nobody starves', async () => {
    await wildOnly('W16')
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: W16_HEAVY_SIZE, at: BROTH_POINT })
      .placeWildCell({ seat: W16_SECOND_SEAT, sizeFactor: W16_OVER_SIZE, at: W16_SECOND_AT })
      .advance(W16_READ_TICK)
      .expect('after tick 1 seat 0 starves and seat 1 does not', (view) => [
        wildSeatOf(view, PLACED_SEAT)?.isStarving,
        wildSeatOf(view, W16_SECOND_SEAT)?.isStarving,
      ])
      .atTick(ONE_TICK)
      .toEqual([true, false])
      .expect('after tick 60 still only seat 0, although the total is still over the budget', (view) => [
        wildSeatOf(view, PLACED_SEAT)?.isStarving,
        wildSeatOf(view, W16_SECOND_SEAT)?.isStarving,
      ])
      .atTick(W16_READ_TICK)
      .toEqual([true, false])
      .runDeterministic();
    await wildOnly('W16 under the budget')
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: W16_HEAVY_SIZE, at: BROTH_POINT })
      .placeWildCell({ seat: W16_SECOND_SEAT, sizeFactor: W16_UNDER_SIZE, at: W16_SECOND_AT })
      .advance(W16_VARIANT_TICKS)
      .expect('neither starves in 600 ticks, and both sit at their base sizes exactly', (view) => {
        const worldMass = worldMassAtTick(view.snapshot.tick);
        return [PLACED_SEAT, W16_SECOND_SEAT].every((seat) => {
          const record = wildSeatOf(view, seat);
          return (
            record !== undefined && !record.isStarving && wildCellOf(view, seat)?.mass === worldMass * record.sizeFactor
          );
        });
      })
      .atTick(W16_VARIANT_TICKS)
      .toBe(true)
      .runDeterministic();
  });
});
