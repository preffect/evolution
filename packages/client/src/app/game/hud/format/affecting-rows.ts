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
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { LEVEL_GOLD, TEXT, TEXT_LABEL, ZONE_CUE } from '../../render/constants';
import { MASS_TREND, type MassTrend } from '../../state/mass-trend';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import { HUD_TEST_ID, affectingTraitTestId } from '../../test-ids/hud-test-ids';
import { causeRowsFor } from './affecting-causes';
import { sizeRowsFor } from './affecting-size';
import { joinFacts } from './fact-line';
import { leadingMultiplier, type RoundClockState } from './round-clock';
import type { ModifierEffect } from '../../quantities/modifier-labels';
import { describeTierModifierEffects, describeTierModifiers } from './trait-effects';
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
  /** Set on an owned-trait row with an effect: what its value does for the cell, which tones it (#453). */
  readonly valueEffect: ModifierEffect | null;
}

/**
 * A section, already split into the two tables the panel draws it as. The split is a decision about the rows, so it
 * is made here with them rather than in the component: the kit's facts table draws either its own dot-and-ring
 * markers or a feature's marker slot, never both in one table, so the glyph-marked trait rows and the plain rows
 * cannot share one. Splitting here also means the component allocates nothing per change detection.
 */
export interface AffectingSection {
  readonly sectionId: AffectingSectionId;
  readonly heading: string;
  /** Every row of the section, in order: the trait rows first, then the plain ones. */
  readonly rows: readonly AffectingRow[];
  /** The rows whose marker is a #312 trait glyph; empty in every section but `TRAITS`. */
  readonly traitRows: readonly AffectingRow[];
  /** The rows the kit marks with its own dot or ring. */
  readonly plainRows: readonly AffectingRow[];
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

/** A section with no rows is left out entirely, heading and rule included. */
const NO_ROWS = 0;
/** The bloom row names what the bloom multiplies, as §3.7 writes it. */
const BLOOM_ROW_NAME = 'Bloom';
const BLOOM_FOOD_NAME = 'food';
const BLOOM_DNA_NAME = 'DNA drops';
const WORLD_ROW_NAME = 'World';

/** How the standing reads to a player: at the world's level is `level`, which `with` would not say. */
export const WORLD_STANDING_WORD: Readonly<Record<WorldStanding, string>> = {
  [WORLD_STANDING.ahead]: 'ahead',
  [WORLD_STANDING.with]: 'level',
  [WORLD_STANDING.behind]: 'behind',
};

/** A row the kit marks with a dot or ring rather than a glyph. */
function plainRow(row: UiFactRow): AffectingRow {
  return { ...row, traitId: null, valueEffect: null };
}

/**
 * The zone's row: the whole pill text in `body` across the row, as §3.7 specifies, and no right-hand value.
 *
 * These facts are prose, not figures. The kit draws `values` in the mono `figure` face and never wraps a cell, so a
 * fact line put there is cut at the panel's edge mid-word — `decay ×1.5 · orange` — losing exactly the part that
 * tells the player what to go and eat. The name column is the sans `body` face and takes the row's slack, which is
 * what the pill's own line is sized for. The open broth has nothing to say and gets no row.
 */
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
  return [
    plainRow({
      rowId: HUD_TEST_ID.affectingZone,
      name: text,
      values: [],
      marker: { shape: UI_FACT_MARKER_SHAPE.dot, colour: ZONE_CUE[zone.zone] ?? TEXT_LABEL },
    }),
  ];
}

/** `Bloom · 1:48 · food ×1.5 · DNA drops ×2` in `body`, for the same reason the zone row is; only while in bloom. */
function bloomRows(input: AffectingRowsInput): readonly AffectingRow[] {
  if (!input.roundClock.isBloom) return [];
  const { ecology } = input.balance;
  const facts = [
    BLOOM_ROW_NAME,
    input.roundClock.text,
    `${BLOOM_FOOD_NAME} ${leadingMultiplier(ecology.FOOD_BLOOM_SPAWN_MULTIPLIER)}`,
    `${BLOOM_DNA_NAME} ${leadingMultiplier(ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER)}`,
  ];
  return [
    plainRow({
      rowId: HUD_TEST_ID.affectingBloom,
      name: joinFacts(facts),
      values: [],
      marker: { shape: UI_FACT_MARKER_SHAPE.dot, colour: LEVEL_GOLD },
    }),
  ];
}

/**
 * One row per owned trait, in catalog order, each reading the first line of its tier's effects.
 *
 * An owned trait always earns its row — it is acting on the cell whether or not its tier has a line to show — but a
 * tier with no described modifier gets no value cell at all rather than an empty one, which is the same rule the
 * rest of the panel follows: nothing to say is said by omission, never by a blank.
 */
function traitRows(input: AffectingRowsInput): readonly AffectingRow[] {
  return TRAIT_CATALOG.flatMap((definition) => {
    const owned = input.ownCell.traits.find((trait) => trait.traitId === definition.id);
    if (owned === undefined) return [];
    const tier = formatQuantity(owned.tier, QUANTITY_UNIT.tier, { presentation: QUANTITY_PRESENTATION.numeral });
    const [effect] = describeTierModifiers(input.balance.traits, definition.id, owned.tier);
    const [effectTone] = describeTierModifierEffects(input.balance.traits, definition.id, owned.tier);
    return [
      {
        rowId: affectingTraitTestId(definition.id),
        name: `${definition.name} ${tier}`,
        values: effect === undefined ? [] : [effect],
        marker: null,
        traitId: definition.id,
        valueEffect: effectTone ?? null,
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

/** A section's heading and its split into the two tables the panel draws it as. */
function sectionOf(sectionId: AffectingSectionId, rows: readonly AffectingRow[]): AffectingSection {
  return {
    sectionId,
    heading: AFFECTING_SECTION_HEADING[sectionId],
    rows,
    traitRows: rows.filter((row) => row.traitId !== null),
    plainRows: rows.filter((row) => row.traitId === null),
  };
}

/** The whole panel: the mass element, then the sections, each without the rows that would read zero. */
export function affectingRowsFor(input: AffectingRowsInput): AffectingPanel {
  const causes = causeRowsFor(input).map(plainRow);
  const sections = [
    sectionOf(AFFECTING_SECTION.mass, causes),
    sectionOf(AFFECTING_SECTION.here, [...zoneRows(input), ...bloomRows(input)]),
    sectionOf(AFFECTING_SECTION.size, sizeRowsFor(input).map(plainRow)),
    sectionOf(AFFECTING_SECTION.traits, [...traitRows(input), worldRow(input)]),
  ];
  return { mass: massElementOf(input), sections: sections.filter((section) => section.rows.length > NO_ROWS) };
}
