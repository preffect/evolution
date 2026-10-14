// The Effects by tier table (docs/ui/encyclopedia.md §11.4). The unit lives in the row's name and the cells hold bare
// figures (#858), so the guards below read both halves off real entries — Chloroplast's `mass / s`, Mitochondrion's
// percent — and the hand-built sections carry the same split the resolver makes.

import { DEFAULT_BALANCE, TRAIT_CATALOG, type TraitTier } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { unbroken } from '../../../../testing/unbroken-quantity';
import { MODIFIER_EFFECT } from '../../quantities/modifier-labels';
import {
  ENCYCLOPEDIA_TIER_CAPTION_PREFIX,
  ENCYCLOPEDIA_TIER_IDENTITY_TEXT,
  ENCYCLOPEDIA_TIER_UNIT_CLOSE,
  ENCYCLOPEDIA_TIER_UNIT_OPEN,
} from '../encyclopedia-constants';
import type { ResolvedEntry, ResolvedFact, ResolvedSection } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import { resolveEntry } from '../registry';
import { tierNumeral } from './entry-view';
import { factNameFromNoun, tierRowName, tierTableFor } from './tier-table';

const MITOCHONDRION = 'trait:mitochondrion' as EntryId;
const CHLOROPLAST = 'trait:chloroplast' as EntryId;
const PROTOCELL = 'stage:protocell' as EntryId;
const FIRST = 1 as TraitTier;
const SECOND = 2 as TraitTier;

function resolve(entryId: EntryId): ResolvedEntry {
  return resolveEntry(entryId, { balance: DEFAULT_BALANCE });
}

/** A tier fact as the resolver makes one: the whole text, and the figure and unit the table splits it into. */
function tierFact(key: string, label: string, figure: string, unit: string): ResolvedFact {
  return { key, label, text: `${figure} ${unit}`, link: null, parts: { figure, unit } };
}

function tierSection(key: string, facts: readonly ResolvedFact[]): ResolvedSection {
  return { key, heading: [], body: [], facts, preview: null };
}

describe('tierTableFor (docs/ui/encyclopedia.md §11.4)', () => {
  it('draws one column per tier section and one row per modifier any tier sets, in the entry’s own numbers', () => {
    const entry = resolve(MITOCHONDRION);
    const table = tierTableFor(entry.sections, null);
    expect(table?.columns).toEqual(entry.sections.map((_section, index) => tierNumeral((index + 1) as TraitTier)));
    const firstTier = entry.sections[0]!.facts;
    expect(table?.rows.map((row) => row.name)).toEqual(firstTier.map(tierRowName));
    expect(table?.rows[0]?.values[0]).toBe(firstTier[0]!.parts?.figure);
  });

  /** #858: the unit once, in the row's name; each tier a bare figure that cannot break from it. */
  it('names Chloroplast’s sunlight row with its unit and writes its tiers as bare figures', () => {
    const photosynthesis = tierTableFor(resolve(CHLOROPLAST).sections, null)?.rows.find(
      (row) => row.rowId === 'photosynthesisMassPerSecond',
    );
    expect(photosynthesis?.name).toBe(
      `In sunlight${ENCYCLOPEDIA_TIER_UNIT_OPEN}${unbroken('mass / s')}${ENCYCLOPEDIA_TIER_UNIT_CLOSE}`,
    );
    expect(photosynthesis?.values).toEqual(['+0.3', '+0.6', '+0.9']);
  });

  it('puts no unit in any tier cell of any trait, and a unit in every row’s name', () => {
    for (const trait of TRAIT_CATALOG) {
      const table = tierTableFor(resolve(`trait:${trait.id}` as EntryId).sections, null);
      for (const row of table?.rows ?? []) {
        expect(row.name, trait.id).toMatch(/\(.+\)$/);
        for (const value of row.values) {
          expect(value, `${trait.id} ${row.rowId}`).toMatch(/^([+−]?\d+(\.\d+)?|—)$/);
        }
      }
    }
  });

  /** #453: Mitochondrion's less decay prints with a minus in every tier and helps in every one. */
  it('tones each tier cell by its effect on the owner, not by its sign', () => {
    const table = tierTableFor(resolve(MITOCHONDRION).sections, null);
    const decay = table?.rows.find((row) => row.rowId === 'decayMultiplier');
    expect(decay?.values.every((value) => value.startsWith('−'))).toBe(true);
    expect(decay?.effects?.every((effect) => effect === MODIFIER_EFFECT.benefit)).toBe(true);
  });

  it('writes the identity dash where one tier leaves a key the others set, and only there', () => {
    const table = tierTableFor(
      [
        tierSection('tier_1', [tierFact('speedMultiplier', 'speed', '+10', '%')]),
        tierSection('tier_2', [
          tierFact('speedMultiplier', 'speed', '+20', '%'),
          tierFact('decayMultiplier', 'mass decay', '−15', '%'),
        ]),
      ],
      null,
    );
    expect(table?.rows.map((row) => row.values)).toEqual([
      ['+10', '+20'],
      [ENCYCLOPEDIA_TIER_IDENTITY_TEXT, '−15'],
    ]);
  });

  it('tints the owned tier’s column under its caption, and neither outside a round', () => {
    const sections = [
      tierSection('tier_1', [tierFact('speedMultiplier', 'speed', '+10', '%')]),
      tierSection('tier_2', [tierFact('speedMultiplier', 'speed', '+20', '%')]),
    ];
    expect(tierTableFor(sections, SECOND)).toMatchObject({
      highlightColumn: 1,
      caption: `${ENCYCLOPEDIA_TIER_CAPTION_PREFIX}II`,
    });
    expect(tierTableFor(sections, FIRST)?.highlightColumn).toBe(0);
    expect(tierTableFor(sections, null)).toMatchObject({ highlightColumn: null, caption: '' });
  });

  it('is left out, never drawn empty, for an entry with no tier section and for tiers that set nothing', () => {
    expect(tierTableFor(resolve(PROTOCELL).sections, null)).toBeNull();
    expect(tierTableFor([tierSection('tier_1', [])], null)).toBeNull();
    expect(tierTableFor([tierSection('aerobic', [tierFact('speedMultiplier', 'speed', '+10', '%')])], null)).toBeNull();
  });
});

describe('tierRowName (docs/ui/encyclopedia.md §11.4)', () => {
  it('writes the unit after the noun, in brackets', () => {
    expect(tierRowName(tierFact('decayMultiplier', 'mass decay', '−15', '%'))).toBe(
      `Mass decay${ENCYCLOPEDIA_TIER_UNIT_OPEN}%${ENCYCLOPEDIA_TIER_UNIT_CLOSE}`,
    );
  });

  it('adds nothing for a unit with no header form, and reads a fact without a split as its noun alone', () => {
    expect(tierRowName(tierFact('count', 'count', '3', ''))).toBe('Count');
    expect(tierRowName({ key: 'speedMultiplier', label: 'speed', text: '+10 %', link: null })).toBe('Speed');
  });

  it('keeps the unit in the cell for a fact without a split, so the row still names it exactly once', () => {
    const unsplit: ResolvedFact = { key: 'speedMultiplier', label: 'speed', text: '+10 %', link: null };
    const table = tierTableFor([tierSection('tier_1', [unsplit])], null);
    expect(table?.rows.map((row) => [row.name, ...row.values])).toEqual([['Speed', '+10 %']]);
  });
});

/**
 * The nouns are the trait cards' (`+15 % speed`), so they arrive lowercase; §11.4 writes the table's row as
 * `Mass decay`. The real nouns are checked rather than a made-up pair, so a catalog that starts capitalising them
 * does not quietly get double-capitalised here.
 */
describe('factNameFromNoun', () => {
  it('reads a modifier noun as a sentence, and leaves one that already is alone', () => {
    expect(factNameFromNoun('mass decay')).toBe('Mass decay');
    expect(factNameFromNoun('Mass decay')).toBe('Mass decay');
    expect(factNameFromNoun('')).toBe('');
  });
});
