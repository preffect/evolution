// docs/traits/catalog-forms.md §3.18 ("Engulf effects at a glance") against the tier tables, one test per row,
// plus T20 (docs/traits/constants-and-acceptance.md §6). The rows are parsed from the doc itself, as the
// constants ledger parses its tables, so a trait whose tiers set an engulf hook the table does not name,
// or a hook the table names at values the tiers do not carry, fails on either side. A row that names a
// modifier must state its three tier values: a doc whose format drifts fails here rather than passing with
// nothing parsed.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CellModifiers, TraitDefinition } from '../types/traits.js';
import { TRAIT_CATALOG } from './traits.js';
import { markdownSection, tableRows } from '../testing/markdown-document.js';

const CATALOG_FORMS_DOCUMENT = new URL('../../../../docs/traits/catalog-forms.md', import.meta.url);
const SECTION_HEADING = '### 3.18 Engulf effects at a glance';

/** The engulf hooks T20 names: every trait not listed for one in §3.18 sets none of them at any tier. */
const ENGULF_HOOKS = [
  'membraneRatioBonus',
  'absorbDurationMultiplierAsPrey',
  'wrapDurationMultiplierAsPredator',
  'absorbDurationMultiplierAsPredator',
  'gripStrengthBonus',
  'gripResistanceBonus',
  'struggleSlowdownBonus',
  'spitOutChancePerSecond',
  'spikeDrainFractionPerSecond',
  'engulfMassYieldBonus',
] as const satisfies readonly (keyof CellModifiers)[];

/** The eight traits T20 lists as setting no engulf hook. */
const HOOKLESS_TRAIT_IDS = [
  'nucleoid',
  'simple_flagellum',
  'ribosomes',
  'mitochondrion',
  'chloroplast',
  'nuclear_envelope',
  'euglena_eyespot',
  'stentor_trumpet',
];

/** A backticked lowerCamelCase modifier name, as the rows write it. */
const MODIFIER_NAME_PATTERN = /`([a-z][A-Za-z]*)`/g;
/** One tier value: `0.85`, `+0.1` or `1.0`. */
const TIER_VALUE = String.raw`\+?\d+(?:\.\d+)?`;
const HEADER_CELL = 'Trait';
/** Trait, as predator, as prey, and the notes after them. */
const MINIMUM_ROW_CELLS = 4;
const TIER_COUNT = 3;

class EngulfEffectsDocumentError extends Error {}

interface EngulfEffectRow {
  readonly traitName: string;
  /** The predator and prey cells joined: where the hooks are named. */
  readonly effects: string;
}

function engulfEffectRows(): EngulfEffectRow[] {
  // A missing heading throws in the reader, naming it.
  const section = markdownSection(readFileSync(CATALOG_FORMS_DOCUMENT, 'utf8'), SECTION_HEADING);
  const rows = tableRows(section)
    .filter((cells) => cells.length >= MINIMUM_ROW_CELLS && cells[0] !== HEADER_CELL)
    .map(([traitName, predator, prey]) => ({ traitName: traitName!, effects: `${predator} ${prey}` }));
  if (rows.length === 0) {
    throw new EngulfEffectsDocumentError(`${SECTION_HEADING} parsed no rows: the table's format changed`);
  }
  return rows;
}

const rows = engulfEffectRows();
const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
const isEngulfHook = (name: string): name is (typeof ENGULF_HOOKS)[number] =>
  (ENGULF_HOOKS as readonly string[]).includes(name);

function hooksSetBy(trait: TraitDefinition): string[] {
  const names = new Set(trait.tiers.flatMap((tier) => Object.keys(tier)));
  return [...names].filter(isEngulfHook).sort();
}

/** The names of every modifier the row writes in backticks, in order, with duplicates dropped. */
function modifiersNamedBy(effects: string): string[] {
  return [...new Set([...effects.matchAll(MODIFIER_NAME_PATTERN)].map((match) => match[1]!))];
}

/** The three tier values the row states right after `` `name` ``; null when it states none. */
function tierValuesOf(effects: string, name: string): number[] | null {
  const stated = new RegExp(String.raw`\`${name}\` (${TIER_VALUE}) / (${TIER_VALUE}) / (${TIER_VALUE})`).exec(effects);
  return stated === null ? null : stated.slice(1, 1 + TIER_COUNT).map(Number);
}

describe('traits/catalog-forms.md §3.18: one row per build-1 trait', () => {
  it('has exactly the catalog, by name', () => {
    expect(rows.map((row) => row.traitName).sort()).toEqual(catalog.map((trait) => trait.name).sort());
  });
});

describe.each(rows)('§3.18 $traitName', ({ traitName, effects }) => {
  const trait = catalog.find((candidate) => candidate.name === traitName)!;

  it('sets exactly the engulf hooks its row names', () => {
    const named = modifiersNamedBy(effects).filter(isEngulfHook);
    expect(hooksSetBy(trait)).toEqual([...named].sort());
  });

  it('carries the tier I / II / III values its row states for every modifier it names', () => {
    for (const name of modifiersNamedBy(effects)) {
      const stated = tierValuesOf(effects, name);
      expect(stated, `§3.18 ${traitName} states three tier values for ${name}`).not.toBeNull();
      expect(
        trait.tiers.map((tier) => tier[name as keyof CellModifiers]),
        `${traitName} ${name}`,
      ).toEqual(stated);
    }
  });
});

describe('T20: the traits that set no engulf hook', () => {
  it.each(HOOKLESS_TRAIT_IDS)('%s sets none of them at any tier', (traitId) => {
    expect(hooksSetBy(catalog.find((trait) => trait.id === traitId)!)).toEqual([]);
  });
});
