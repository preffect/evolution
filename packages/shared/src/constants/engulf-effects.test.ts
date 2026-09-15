// docs/traits/catalog-forms.md §3.18 ("Engulf effects at a glance") against the tier tables, one test per row,
// plus T20 (docs/traits/constants-and-acceptance.md §6). The rows are parsed from the doc itself, as the
// constants ledger parses its tables, so a trait whose tiers set an engulf hook the table does not name,
// or a hook the table names at values the tiers do not carry, fails on either side.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CellModifiers, TraitDefinition } from '../types/traits.js';
import { TRAIT_CATALOG } from './traits.js';

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

/** `` `name` 0.85 / 0.75 / 0.65 `` or `` `name` +0.1 / +0.2 / +0.3 ``: a modifier and its tier I..III values. */
const TIERED_VALUE_PATTERN = /`([a-z][A-Za-z]*)` (\+?\d+(?:\.\d+)?) \/ (\+?\d+(?:\.\d+)?) \/ (\+?\d+(?:\.\d+)?)/g;
const TABLE_ROW_PATTERN = /^\| ([^|]+?) +\| (.+?) +\| (.+?) +\| .+\|$/;
const HEADER_CELL = 'Trait';
const SEPARATOR_CELL_PATTERN = /^-+$/;

interface EngulfEffectRow {
  readonly traitName: string;
  /** The predator and prey cells joined: where the hooks are named. */
  readonly effects: string;
}

function engulfEffectRows(): EngulfEffectRow[] {
  const lines = readFileSync(CATALOG_FORMS_DOCUMENT, 'utf8').split('\n');
  const start = lines.indexOf(SECTION_HEADING);
  expect(start, SECTION_HEADING).toBeGreaterThanOrEqual(0);
  const rows: EngulfEffectRow[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('#')) break;
    const match = TABLE_ROW_PATTERN.exec(line);
    if (match === null || match[1] === HEADER_CELL || SEPARATOR_CELL_PATTERN.test(match[1]!)) continue;
    rows.push({ traitName: match[1]!, effects: `${match[2]} ${match[3]}` });
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

describe('traits/catalog-forms.md §3.18: one row per build-1 trait', () => {
  it('has exactly the catalog, by name', () => {
    expect(rows.map((row) => row.traitName).sort()).toEqual(catalog.map((trait) => trait.name).sort());
  });
});

describe.each(rows)('§3.18 $traitName', ({ traitName, effects }) => {
  const trait = catalog.find((candidate) => candidate.name === traitName)!;

  it('sets exactly the engulf hooks its row names', () => {
    const named = [...effects.matchAll(/`([a-z][A-Za-z]*)`/g)].map((match) => match[1]!).filter(isEngulfHook);
    expect(hooksSetBy(trait)).toEqual([...new Set(named)].sort());
  });

  it('carries the tier I / II / III values its row states', () => {
    for (const [, name, ...values] of effects.matchAll(TIERED_VALUE_PATTERN)) {
      const tierValues = trait.tiers.map((tier) => tier[name as keyof CellModifiers]);
      expect(tierValues, `${traitName} ${name}`).toEqual(values.map(Number));
    }
  });
});

describe('T20: the traits that set no engulf hook', () => {
  it.each(HOOKLESS_TRAIT_IDS)('%s sets none of them at any tier', (traitId) => {
    expect(hooksSetBy(catalog.find((trait) => trait.id === traitId)!)).toEqual([]);
  });
});
