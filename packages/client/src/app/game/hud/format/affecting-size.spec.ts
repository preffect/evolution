// @vitest-environment node
// The `Eats you` row against the giants (docs/ecology/giants.md §3.5.11): its figure is a cell eater's, the least mass
// `canEngulf` asks of a player, a wild cell or the giant amoeba to swallow us. The paramecium and the diatom eat no cell
// at any mass (shared `engulf-eligibility` tests), so the row is not about them. The panel's worked example and the
// rounding rules are `affecting-rows.spec.ts`'s.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES, canEngulf, type GiantSpecies } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { AT_LEAST_SIGN } from '../../quantities/quantity-unit';
import { HUD_TEST_ID } from '../../test-ids/hud-test-ids';
import { sizeRowsFor } from './affecting-size';

const OWN_CELL = createTestCellView({ mass: 312 });
/** The figure's own step: one decimal, so a cell one step lighter must be harmless. */
const FIGURE_STEP = 0.1;

function threatFigure(): number {
  const row = sizeRowsFor({ ownCell: OWN_CELL, balance: DEFAULT_BALANCE }).find(
    (candidate) => candidate.rowId === HUD_TEST_ID.affectingThreatAbove,
  );
  return Number(row?.values[0]?.replace(`${AT_LEAST_SIGN} `, ''));
}

function eats(mass: number, giantSpecies: GiantSpecies | null): boolean {
  return canEngulf(createTestCellView({ mass, giantSpecies }), OWN_CELL, DEFAULT_BALANCE.absorption);
}

describe('sizeRowsFor: the Eats you row and the giants', () => {
  it.each([null, GIANT_SPECIES.amoeba])('is the least mass a cell eater (%s) needs to swallow us', (species) => {
    const figure = threatFigure();
    expect(eats(figure, species)).toBe(true);
    expect(eats(figure - FIGURE_STEP, species)).toBe(false);
  });
});
