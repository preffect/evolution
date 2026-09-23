// The mass causes on the hold-Tab "affecting you" panel (docs/ui/overlays.md §3.7): the `Food` row and one row per
// cause the server's metabolism applied this tick, each named with the thing responsible for it — the trait that
// cuts decay, the vent's multiplier, the cell whose toxin reaches us, the prey we are swallowing.
//
// Every rate is the server's own number (`massFlow.ratesPerSecond` and the `eat` effects' `massGained`, #383),
// formatted by `formatMassRate`; nothing here re-derives a rate from a formula, and no literal from §3.7's worked
// example is typed. A cause the wire omits is a cause at zero, and a zero row is left out rather than shown as `0`.
//
// It lives beside `affecting-rows.ts` rather than inside it because naming the cause is most of the work: the row
// builder would otherwise run past the size bar. Pure and DOM-free.

import {
  MASS_RATE_CAUSE,
  MASS_RATE_CAUSES,
  TRAIT_CATALOG,
  type BalanceConfig,
  type CellView,
  type MassRateCause,
  type OwnProgressView,
  type PlayerRosterView,
} from '@evolution/shared';
import { UI_FACT_MARKER_SHAPE, type UiFactMarker, type UiFactRow } from '../../../ui-kit/ui-facts-table.component';
import { GAIN, TEXT_LABEL } from '../../render/constants';
import { HUD_TEST_ID, affectingCauseTestId } from '../../test-ids/hud-test-ids';
import { joinFacts } from './fact-line';
import { CUE_RIM_COLOUR, RATE_CAUSE_LABEL, RATE_CAUSE_RIM, decayTraitShareOf, formatMassRate } from './mass-cues';
import { leadingMultiplier } from './round-clock';
import { isToxicCell } from './relations-for';
import { cellDisplayName, distanceSquaredBetween } from './threats-for';

/** What the cause rows are built from; the caller holds the window the `Food` rate was measured over. */
export interface AffectingCausesInput {
  readonly ownCell: CellView;
  readonly ownProgress: OwnProgressView;
  readonly balance: BalanceConfig;
  /** Every cell in the newest snapshot: the toxin and swallowed rows name one of them. */
  readonly cells: readonly CellView[];
  readonly players: Readonly<Record<string, PlayerRosterView>>;
  /** `foodGainPerSecondFor(...)`: the `eat` gains of the last `AFFECTING_FOOD_WINDOW_SECONDS`, as a rate. */
  readonly foodGainPerSecond: number;
}

const NO_RATE = 0;
/** The word before the cell a toxin reaches us from: `Toxin · near Nib`. */
const TOXIN_SOURCE_PREFIX = 'near';
/** The `Food` row's name; food is a gain from eating, not one of the metabolism's `MassRateCause` rows. */
const FOOD_ROW_NAME = 'Food';

/** A cause's dot, in the colour its cue's rim carries; a rimless cause (decay) marks in the label colour. */
function causeMarker(cause: MassRateCause): UiFactMarker {
  return { shape: UI_FACT_MARKER_SHAPE.dot, colour: CUE_RIM_COLOUR[RATE_CAUSE_RIM[cause]] ?? TEXT_LABEL };
}

/** `Mitochondrion ×0.85`: the trait cutting decay the most and the cut it makes, both `mass-cues.ts`'s wording. */
function decayQualifier(input: AffectingCausesInput): string | null {
  const massFlow = input.ownProgress.massFlow;
  if (massFlow === null) return null;
  const share = decayTraitShareOf(massFlow, input.ownCell.traits, input.balance);
  if (share === null) return null;
  const definition = TRAIT_CATALOG.find((row) => row.id === share.traitId);
  return definition === undefined ? null : `${definition.name} ${share.text}`;
}

/** `decay ×1.5`, the vent's own multiplier, from the live balance. */
function ventQualifier(input: AffectingCausesInput): string {
  return `decay ${leadingMultiplier(input.balance.ecology.VENT_DECAY_MULTIPLIER)}`;
}

/**
 * `near Nib`: the nearest toxic cell, which is the one the player has to move away from. The rate itself is the
 * server's sum over every cell reaching us, so this names the likeliest source rather than claiming to be the only
 * one; the reach rule stays on the server and is never re-derived here.
 *
 * One pass for one minimum, rather than folding every cell's modifiers and then sorting the survivors: the panel is
 * rebuilt on every snapshot for as long as Tab is held, and only the nearest cell is ever read.
 */
function toxinQualifier(input: AffectingCausesInput): string | null {
  const { ownCell, balance } = input;
  let nearest: CellView | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const cell of input.cells) {
    if (cell.id === ownCell.id) continue;
    const distanceSquared = distanceSquaredBetween(cell, ownCell);
    if (distanceSquared >= nearestDistanceSquared) continue;
    if (!isToxicCell(cell, balance)) continue;
    nearest = cell;
    nearestDistanceSquared = distanceSquared;
  }
  return nearest === null ? null : `${TOXIN_SOURCE_PREFIX} ${cellDisplayName(nearest, input.players)}`;
}

/** `Nib`: the prey this cell is swallowing, whose spikes and toxin are the dose (#154). */
function swallowedQualifier(input: AffectingCausesInput): string | null {
  const preyId = input.ownCell.engulfingCellId;
  if (preyId === null) return null;
  const prey = input.cells.find((cell) => cell.id === preyId);
  return prey === undefined ? null : cellDisplayName(prey, input.players);
}

/**
 * What each cause adds after its name. A record of builders rather than a switch: a new cause is a row here, and
 * the type stops compiling until it has one.
 */
const CAUSE_QUALIFIER: Readonly<Record<MassRateCause, (input: AffectingCausesInput) => string | null>> = {
  [MASS_RATE_CAUSE.toxin]: toxinQualifier,
  [MASS_RATE_CAUSE.swallowed]: swallowedQualifier,
  [MASS_RATE_CAUSE.decay]: decayQualifier,
  [MASS_RATE_CAUSE.vent]: ventQualifier,
  [MASS_RATE_CAUSE.light]: () => null,
};

/** `Decay · Mitochondrion ×0.85`, or plain `Light` where the cause has nothing to add. */
function causeName(cause: MassRateCause, input: AffectingCausesInput): string {
  const qualifier = CAUSE_QUALIFIER[cause](input);
  const label = RATE_CAUSE_LABEL[cause];
  return qualifier === null ? label : joinFacts([label, qualifier]);
}

/** `Food · +1.1/s`, omitted while nothing has been eaten in the window rather than shown as `+0/s`. */
function foodRow(input: AffectingCausesInput): readonly UiFactRow[] {
  if (input.foodGainPerSecond <= NO_RATE) return [];
  return [
    {
      rowId: HUD_TEST_ID.affectingCauseFood,
      name: FOOD_ROW_NAME,
      values: [formatMassRate(input.foodGainPerSecond)],
      marker: { shape: UI_FACT_MARKER_SHAPE.dot, colour: GAIN },
    },
  ];
}

/**
 * The `Food` row and one row per applied cause, in `MASS_RATE_CAUSE` declaration order so the rows never reorder
 * themselves as the rates move. A cause the wire omits, or one that came through at zero, has no row.
 */
export function causeRowsFor(input: AffectingCausesInput): readonly UiFactRow[] {
  const rates = input.ownProgress.massFlow?.ratesPerSecond ?? {};
  const causeRows = MASS_RATE_CAUSES.flatMap((cause) => {
    const rate = rates[cause];
    if (rate === undefined || rate === NO_RATE) return [];
    return [
      {
        rowId: affectingCauseTestId(cause),
        name: causeName(cause, input),
        values: [formatMassRate(rate)],
        marker: causeMarker(cause),
      },
    ];
  });
  return [...foodRow(input), ...causeRows];
}
