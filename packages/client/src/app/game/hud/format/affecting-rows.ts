// The hold-Tab "affecting you" panel's record (docs/ui/overlays.md §3.7, decision #324): everything acting on the
// own cell at once, as the mass element that sits above the table and four sections of named rows. The cues on the
// cell (docs/ui/hud.md §3.1.5) say what is happening this second; this says what is acting on the cell at all, for
// the player who stops to ask why.
//
// Every number is computed from the live `balance` and the shared formulas, never from the literals §3.7's worked
// example prints: the doc's `249.6` and `390` are that example's values at mass 312 under the default balance, and
// a retuned `ENGULF_MASS_RATIO` has to move them the moment it lands. A row whose value is zero or unknown is left
// out rather than shown as `0`. Pure and DOM-free: the component binds what this answers and decides nothing.

import {
  TRAIT_CATALOG,
  WORLD_STANDING,
  maxSpeedForMass,
  standingAgainstWorld,
  worldElapsedSeconds,
  worldReference,
  type BalanceConfig,
  type CellView,
  type OwnProgressView,
  type PlayerRosterView,
  type TraitId,
  type ValueOf,
  type WorldStanding,
} from '@evolution/shared';
import { UI_FACT_MARKER_SHAPE, type UiFactRow } from '../../../ui-kit/ui-facts-table.component';
import { formatQuantity } from '../../quantities/format-quantity';
import { AT_LEAST_SIGN, AT_MOST_SIGN, QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { DANGER, GAIN, LEVEL_GOLD, TEXT, TEXT_LABEL, ZONE_CUE } from '../../render/constants';
import { MASS_TREND, type MassTrend } from '../../state/mass-trend';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import { HUD_TEST_ID, affectingTraitTestId } from '../test-ids';
import { causeRowsFor } from './affecting-causes';
import { FACT_SEPARATOR, joinFacts } from './fact-line';
import { leadingMultiplier, type RoundClockState } from './round-clock';
import { describeTierModifiers } from './trait-effects';
import { zonePillText } from './zone-pill';

/** The panel's four sections, in the order they are drawn. */
export const AFFECTING_SECTION = { mass: 'mass', here: 'here', size: 'size', traits: 'traits' } as const;
export type AffectingSectionId = ValueOf<typeof AFFECTING_SECTION>;

/** Each section's heading, uppercased by the kit's `label` role when drawn, never here. */
export const AFFECTING_SECTION_HEADING: Readonly<Record<AffectingSectionId, string>> = {
  [AFFECTING_SECTION.mass]: 'Mass',
  [AFFECTING_SECTION.here]: 'Here',
  [AFFECTING_SECTION.size]: 'Size',
  [AFFECTING_SECTION.traits]: 'Traits',
};

/** A kit facts-table row, plus the trait whose glyph marks it where one does. */
export interface AffectingRow extends UiFactRow {
  /** Set on an owned-trait row: the glyph its marker slot draws at `TRAIT_GLYPH_LIST_PX`; `null` on every other. */
  readonly traitId: TraitId | null;
}

export interface AffectingSection {
  readonly sectionId: AffectingSectionId;
  readonly heading: string;
  readonly rows: readonly AffectingRow[];
}

/** The one row the kit has no shape for: the mass, its trend, its rate and the sparkline, above the table. */
export interface AffectingMass {
  /** The mass, floored, as the cell's own chip reads it. */
  readonly massText: string;
  readonly trend: MassTrend;
  /** `9/s`, unsigned because the trend carries the direction; `null` while the mass reads steady. */
  readonly rateText: string | null;
  /** The masses the sparkline draws, oldest first; fewer than two points draw no line. */
  readonly masses: readonly number[];
}

export interface AffectingPanel {
  readonly mass: AffectingMass;
  readonly sections: readonly AffectingSection[];
}

export interface AffectingRowsInput {
  readonly ownCell: CellView;
  readonly ownProgress: OwnProgressView;
  /** The own-cell record: the mass chip and the zone the server's metabolism used (docs/ui/hud.md §3.1.5). */
  readonly indicators: OwnCellIndicators;
  readonly balance: BalanceConfig;
  /** Every cell in the newest snapshot: the toxin and swallowed rows name one of them. */
  readonly cells: readonly CellView[];
  readonly players: Readonly<Record<string, PlayerRosterView>>;
  /** The clock's record: the bloom row shows only while `isBloom`, and reads its time from `text`. */
  readonly roundClock: RoundClockState;
  readonly tick: number;
  readonly roundStartTick: number;
  readonly roundDurationSeconds: number;
  /** `ownMassesFor(...)`: the sparkline's points, oldest first. */
  readonly masses: readonly number[];
  /** `foodGainPerSecondFor(...)`: the `eat` gains of the last `AFFECTING_FOOD_WINDOW_SECONDS`, as a rate. */
  readonly foodGainPerSecond: number;
}

const NO_SPEED_COST = 0;
const FULL_SPEED = 1;
/** A section with no rows is left out entirely, heading and rule included. */
const NO_ROWS = 0;
/** A threshold keeps one decimal: `≤ 249.6`, and `≥ 390` once the trailing zero is dropped. */
const MASS_THRESHOLD_DECIMALS = 1;
const DECIMAL_BASE = 10;
/** The bloom row names what the bloom multiplies, as §3.7 writes it. */
const BLOOM_ROW_NAME = 'Bloom';
const BLOOM_FOOD_NAME = 'food';
const BLOOM_DNA_NAME = 'DNA drops';
const PREY_BELOW_ROW_NAME = 'You eat';
const THREAT_ABOVE_ROW_NAME = 'Eats you';
const SPEED_ROW_NAME = 'Speed';
const WORLD_ROW_NAME = 'World';

/** How the standing reads to a player: at the world's level is `level`, which `with` would not say. */
export const WORLD_STANDING_WORD: Readonly<Record<WorldStanding, string>> = {
  [WORLD_STANDING.ahead]: 'ahead',
  [WORLD_STANDING.with]: 'level',
  [WORLD_STANDING.behind]: 'behind',
};

/** A row the kit marks with a dot or ring rather than a glyph. */
function plainRow(row: UiFactRow): AffectingRow {
  return { ...row, traitId: null };
}

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

/** The zone's row: its name on the left, the rest of the pill's facts on the right; the open broth has no row. */
function zoneRows(input: AffectingRowsInput): readonly AffectingRow[] {
  const zone = input.indicators.zone;
  if (zone === null) return [];
  const text = zonePillText({
    zone: zone.zone,
    mass: input.ownCell.mass,
    traits: input.ownCell.traits,
    balance: input.balance,
  });
  if (text === null) return [];
  const [name = text, ...facts] = text.split(FACT_SEPARATOR);
  return [
    plainRow({
      rowId: HUD_TEST_ID.affectingZone,
      name,
      values: [joinFacts(facts)],
      marker: { shape: UI_FACT_MARKER_SHAPE.dot, colour: ZONE_CUE[zone.zone] ?? TEXT_LABEL },
    }),
  ];
}

/** `Bloom · 1:48 · food ×1.5 · DNA drops ×2`, only once the bloom has started. */
function bloomRows(input: AffectingRowsInput): readonly AffectingRow[] {
  if (!input.roundClock.isBloom) return [];
  const { ecology } = input.balance;
  const facts = [
    input.roundClock.text,
    `${BLOOM_FOOD_NAME} ${leadingMultiplier(ecology.FOOD_BLOOM_SPAWN_MULTIPLIER)}`,
    `${BLOOM_DNA_NAME} ${leadingMultiplier(ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER)}`,
  ];
  return [
    plainRow({
      rowId: HUD_TEST_ID.affectingBloom,
      name: BLOOM_ROW_NAME,
      values: [joinFacts(facts)],
      marker: { shape: UI_FACT_MARKER_SHAPE.dot, colour: LEVEL_GOLD },
    }),
  ];
}

/**
 * The two engulf thresholds and the size's own speed cost. Both comparisons admit equality, because `canEngulf`
 * does: the prey figure is floored so the row never names a prey that is in fact too heavy, and the threat figure
 * is the mass a cell needs for `canEngulf(it, ownCell)`, the own membrane bonus included.
 */
function sizeRows(input: AffectingRowsInput): readonly AffectingRow[] {
  const { ownCell, balance } = input;
  const preyBelow = flooredToDecimal(ownCell.mass / balance.absorption.ENGULF_MASS_RATIO);
  const threatAbove = ownCell.mass * (balance.absorption.ENGULF_MASS_RATIO + ownCell.membraneRatioBonus);
  const speedShare = maxSpeedForMass(ownCell.mass, balance.growth) / balance.growth.CELL_BASE_SPEED - FULL_SPEED;
  const rows = [
    plainRow({
      rowId: HUD_TEST_ID.affectingPreyBelow,
      name: PREY_BELOW_ROW_NAME,
      values: [`${AT_MOST_SIGN} ${massThresholdText(preyBelow)}`],
      marker: { shape: UI_FACT_MARKER_SHAPE.ring, colour: GAIN },
    }),
    plainRow({
      rowId: HUD_TEST_ID.affectingThreatAbove,
      name: THREAT_ABOVE_ROW_NAME,
      values: [`${AT_LEAST_SIGN} ${massThresholdText(threatAbove)}`],
      marker: { shape: UI_FACT_MARKER_SHAPE.ring, colour: DANGER },
    }),
  ];
  if (speedShare === NO_SPEED_COST) return rows;
  const speedText = formatQuantity(speedShare, QUANTITY_UNIT.share, {
    presentation: QUANTITY_PRESENTATION.signedChange,
  });
  return [
    ...rows,
    plainRow({
      rowId: HUD_TEST_ID.affectingSpeed,
      name: SPEED_ROW_NAME,
      values: [speedText],
      marker: { shape: UI_FACT_MARKER_SHAPE.dot, colour: TEXT_LABEL },
    }),
  ];
}

/** One row per owned trait, in catalog order, each reading the first line of its tier's effects. */
function traitRows(input: AffectingRowsInput): readonly AffectingRow[] {
  return TRAIT_CATALOG.flatMap((definition) => {
    const owned = input.ownCell.traits.find((trait) => trait.traitId === definition.id);
    if (owned === undefined) return [];
    const tier = formatQuantity(owned.tier, QUANTITY_UNIT.tier, { presentation: QUANTITY_PRESENTATION.numeral });
    const [effect] = describeTierModifiers(input.balance.traits, definition.id, owned.tier);
    return [
      {
        rowId: affectingTraitTestId(definition.id),
        name: `${definition.name} ${tier}`,
        values: [effect ?? ''],
        marker: null,
        traitId: definition.id,
      },
    ];
  });
}

/** Where the cell stands against the world clock's average cell: the one row that is never about the cell alone. */
function worldRow(input: AffectingRowsInput): AffectingRow {
  const elapsed = worldElapsedSeconds(input.tick, input.roundStartTick, input.roundDurationSeconds);
  const reference = worldReference(elapsed, input.balance);
  const standing = standingAgainstWorld(input.ownProgress.level, input.ownCell.mass, reference, input.balance);
  return plainRow({
    rowId: HUD_TEST_ID.affectingWorld,
    name: WORLD_ROW_NAME,
    values: [WORLD_STANDING_WORD[standing]],
    marker: { shape: UI_FACT_MARKER_SHAPE.ring, colour: TEXT },
  });
}

/** `steady` shows the mass alone (docs/ui/hud.md §3.1.5), so the rate is dropped rather than shown as `0/s`. */
function massElementOf(input: AffectingRowsInput): AffectingMass {
  const { massChip } = input.indicators;
  return {
    massText: String(massChip.mass),
    trend: massChip.trend,
    rateText: massChip.trend === MASS_TREND.steady ? null : massChip.rateText,
    masses: input.masses,
  };
}

/** The whole panel: the mass element, then the sections, each without the rows that would read zero. */
export function affectingRowsFor(input: AffectingRowsInput): AffectingPanel {
  const causes = causeRowsFor(input).map(plainRow);
  const sections: AffectingSection[] = [
    { sectionId: AFFECTING_SECTION.mass, rows: causes },
    { sectionId: AFFECTING_SECTION.here, rows: [...zoneRows(input), ...bloomRows(input)] },
    { sectionId: AFFECTING_SECTION.size, rows: sizeRows(input) },
    { sectionId: AFFECTING_SECTION.traits, rows: [...traitRows(input), worldRow(input)] },
  ].map((section) => ({ ...section, heading: AFFECTING_SECTION_HEADING[section.sectionId] }));
  return { mass: massElementOf(input), sections: sections.filter((section) => section.rows.length > NO_ROWS) };
}
