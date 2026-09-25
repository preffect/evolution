// The `SIZE` section of the hold-Tab "affecting you" panel (docs/ui/overlays.md §3.7): the two engulf thresholds.
// Size costs no speed (#677), so the section has no speed row.
//
// It lives beside `affecting-rows.ts` rather than inside it for the same reason the cause rows do — the rounding
// contract below is the substance of these two rows, and spelling it out where it is enforced keeps the row
// builder inside its size bar. Pure and DOM-free; every number comes from the live `balance` and the shared
// formulas, never from the literals §3.7's worked example prints.

import type { BalanceConfig, CellView } from '@evolution/shared';
import { UI_FACT_MARKER_SHAPE, type UiFactRow } from '../../../ui-kit/ui-facts-table.component';
import { AT_LEAST_SIGN, AT_MOST_SIGN } from '../../quantities/quantity-unit';
import { DANGER, GAIN } from '../../render/constants';
import { HUD_TEST_ID } from '../../test-ids/hud-test-ids';

/** What the size rows are built from; a structural subset of the panel's own input. */
export interface AffectingSizeInput {
  readonly ownCell: CellView;
  readonly balance: BalanceConfig;
}

/** A threshold keeps one decimal: `≤ 249.6`, and `≥ 390` once the trailing zero is dropped. */
const MASS_THRESHOLD_DECIMALS = 1;
const DECIMAL_BASE = 10;
const PREY_BELOW_ROW_NAME = 'You eat';
const THREAT_ABOVE_ROW_NAME = 'Eats you';

/**
 * A mass threshold's figure: one decimal, trailing zeros dropped. Not `formatMassFigure`, which goes whole from ten
 * up and would print `250` for a 249.6 that a 250-mass prey is safe from — the opposite of what the row promises.
 */
function massThresholdText(mass: number): string {
  return String(Number(mass.toFixed(MASS_THRESHOLD_DECIMALS)));
}

/** Floored, never rounded: at mass 312.1 a rounded `249.7` would name a prey that actually needs 312.125. */
function flooredToDecimal(value: number): number {
  const factor = DECIMAL_BASE ** MASS_THRESHOLD_DECIMALS;
  return Math.floor(value * factor) / factor;
}

/**
 * Ceiled, never rounded: the `≥` half of the same contract the prey figure's floor keeps. At own mass 100.03 the
 * true threshold is 125.0375, and a rounded `125` would name a 125-mass cell as a predator when `canEngulf` says it
 * is harmless.
 */
function ceiledToDecimal(value: number): number {
  const factor = DECIMAL_BASE ** MASS_THRESHOLD_DECIMALS;
  return Math.ceil(value * factor) / factor;
}

/**
 * The two engulf thresholds. Both comparisons admit equality, because `canEngulf`
 * does, and both figures are rounded away from the player being surprised rather than to the nearest decimal: the
 * prey figure down so the row never names a prey that is in fact too heavy, and the threat figure — the mass a cell
 * needs for `canEngulf(it, ownCell)`, the own membrane bonus included — up so it never names a cell that cannot
 * actually eat us.
 */
export function sizeRowsFor(input: AffectingSizeInput): readonly UiFactRow[] {
  const { ownCell, balance } = input;
  const preyBelow = flooredToDecimal(ownCell.mass / balance.absorption.ENGULF_MASS_RATIO);
  const threatAbove = ceiledToDecimal(
    ownCell.mass * (balance.absorption.ENGULF_MASS_RATIO + ownCell.membraneRatioBonus),
  );
  return [
    {
      rowId: HUD_TEST_ID.affectingPreyBelow,
      name: PREY_BELOW_ROW_NAME,
      values: [`${AT_MOST_SIGN} ${massThresholdText(preyBelow)}`],
      marker: { shape: UI_FACT_MARKER_SHAPE.ring, colour: GAIN },
    },
    {
      rowId: HUD_TEST_ID.affectingThreatAbove,
      name: THREAT_ABOVE_ROW_NAME,
      values: [`${AT_LEAST_SIGN} ${massThresholdText(threatAbove)}`],
      marker: { shape: UI_FACT_MARKER_SHAPE.ring, colour: DANGER },
    },
  ];
}
