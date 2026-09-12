// docs/ECOLOGY.md §6.3, the chain row: B engulfs C while A engulfs B. Driven through `runEngulfs`
// rather than through the payout seam, because what is under test is what the rest of the pair walk
// does with the cell the payout frees — which the seam cannot see (the payout's own rules are
// `engulf-payout.test.ts`).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ENGULF_RELEASE_REASON } from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import {
  E9_PAYOUT_TICK,
  ENGULF_CENTRE_DISTANCE_WU,
  ENGULF_PREDATOR_MASS,
  ENGULF_PREY_MASS,
  createEngulfFixture,
  releaseReasonsOf,
  stepEngulf,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import type { CellRecord } from '../world/entities.js';
import { setCellMass } from './cell-mass.js';
import { beginEngulf } from './engulf-state.js';

/**
 * The chain of docs/ECOLOGY.md §6.3: A is about to finish B, and B is engulfing C. C is freed
 * `aborted` at B's last centre, inside A. The roles are assigned by cell id so the row can be
 * driven in both orders: the bug this pins let A re-claim C on the same tick whenever A held the
 * lower id, and made it wait a tick when it held the higher one.
 */
const CHAIN_MIDDLE_MASS = 40;
/** One tick short of the payout: the tick under test is the one that completes A's engulf of B. */
const ALMOST_COMPLETE_PROGRESS = 1 - 1 / E9_PAYOUT_TICK;

function chainAboutToPayOut(
  topIndex: number,
  chainedIndex: number,
): EngulfFixture & { top: CellRecord; chained: CellRecord } {
  const fixture = createEngulfFixture({ predatorMass: ENGULF_PREDATOR_MASS, preyMass: CHAIN_MIDDLE_MASS });
  const cells = [fixture.predator, fixture.prey, fixture.third] as const;
  const top = cells[topIndex]!;
  const middle = cells[1]!;
  const chained = cells[chainedIndex]!;
  setCellMass(top, ENGULF_PREDATOR_MASS, DEFAULT_BALANCE);
  setCellMass(middle, CHAIN_MIDDLE_MASS, DEFAULT_BALANCE);
  setCellMass(chained, ENGULF_PREY_MASS, DEFAULT_BALANCE);
  for (const cell of [top, middle, chained]) {
    cell.x = BROTH_POINT.x + (cell === top ? 0 : ENGULF_CENTRE_DISTANCE_WU);
    cell.y = BROTH_POINT.y;
    cell.targetX = cell.x;
    cell.targetY = cell.y;
  }
  beginEngulf({ predator: top, prey: middle });
  middle.engulfProgress = ALMOST_COMPLETE_PROGRESS;
  beginEngulf({ predator: middle, prey: chained });
  return { ...fixture, top, chained };
}

describe('the chain: what happens to the cell the payout frees (docs/ECOLOGY.md §6.3)', () => {
  it.each([
    ['the top predator holds the lower id', 0, 2],
    ['the top predator holds the higher id', 2, 0],
  ])(
    'frees the chained cell and leaves it unclaimed for the rest of the tick when %s',
    (_case, topIndex, chainedIndex) => {
      const fixture = chainAboutToPayOut(topIndex, chainedIndex);
      stepEngulf(fixture);
      expect(fixture.world.cells).not.toContain(fixture.prey);
      expect(fixture.chained.engulfedByCellId).toBeNull();
      expect(fixture.chained.engulfProgress).toBe(0);
      expect(fixture.chained.states).toEqual([]);
      expect(fixture.top.engulfingCellId).toBeNull();
      expect(releaseReasonsOf(fixture.context.effects)).toEqual([ENGULF_RELEASE_REASON.aborted]);
    },
  );

  it.each([
    ['the lower id', 0, 2],
    ['the higher id', 2, 0],
  ])('lets the top predator start on it on the next tick when it holds %s', (_case, topIndex, chainedIndex) => {
    const fixture = chainAboutToPayOut(topIndex, chainedIndex);
    stepEngulf(fixture, 2);
    expect(fixture.chained.engulfedByCellId).toBe(fixture.top.id);
    expect(fixture.chained.engulfProgress).toBeGreaterThan(0);
  });
});
