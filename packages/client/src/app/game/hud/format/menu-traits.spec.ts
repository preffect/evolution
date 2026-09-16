import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TRAIT_CATALOG, type OwnedTrait, type TraitId } from '@evolution/shared';
import { menuTraitRowsFor, traitEntryId, visibleRowsHeightPx } from './menu-traits';
import { describeTierModifiers } from './trait-effects';

const NUCLEOID = 'nucleoid' as TraitId;
const MITOCHONDRION = 'mitochondrion' as TraitId;

/** The menu's row count, and a row as drawn with one effect line and with two. */
const VISIBLE_ROWS = 5;
const ONE_LINE = 48;
const TWO_LINES = 64;

function catalogNameOf(traitId: TraitId): string {
  return TRAIT_CATALOG.find((trait) => trait.id === traitId)!.name;
}

describe('menuTraitRowsFor', () => {
  const owned: OwnedTrait[] = [
    { traitId: MITOCHONDRION, tier: 1 },
    { traitId: NUCLEOID, tier: 2 },
  ];

  it('lists the owned traits in catalog order, not in the order they were picked', () => {
    const catalogOrder = TRAIT_CATALOG.map((trait) => trait.id as TraitId).filter(
      (traitId) => traitId === NUCLEOID || traitId === MITOCHONDRION,
    );
    expect(menuTraitRowsFor(owned, DEFAULT_BALANCE.traits).map((row) => row.traitId)).toEqual(catalogOrder);
  });

  it('names a row with the catalog name and the tier numeral', () => {
    const rows = menuTraitRowsFor(owned, DEFAULT_BALANCE.traits);
    expect(rows.find((row) => row.traitId === NUCLEOID)?.name).toBe(`${catalogNameOf(NUCLEOID)} II`);
    expect(rows.find((row) => row.traitId === MITOCHONDRION)?.name).toBe(`${catalogNameOf(MITOCHONDRION)} I`);
  });

  it('carries the tier’s effect lines from the generator the picker cards use', () => {
    const row = menuTraitRowsFor(owned, DEFAULT_BALANCE.traits).find((found) => found.traitId === NUCLEOID);
    expect(row?.effects).toEqual(describeTierModifiers(DEFAULT_BALANCE.traits, NUCLEOID, 2));
    expect(row?.effects.length).toBeGreaterThan(0);
  });

  it('links each row to the trait’s encyclopedia entry', () => {
    expect(traitEntryId(NUCLEOID)).toBe('trait:nucleoid');
    expect(menuTraitRowsFor(owned, DEFAULT_BALANCE.traits).map((row) => row.entryId)).toContain('trait:mitochondrion');
  });

  it('names the rows without effect lines before the room’s balance arrives', () => {
    expect(menuTraitRowsFor(owned, null).every((row) => row.effects.length === 0)).toBe(true);
  });

  it('has no rows before the first pick, and none for a trait the catalog does not hold', () => {
    expect(menuTraitRowsFor([], DEFAULT_BALANCE.traits)).toEqual([]);
    expect(menuTraitRowsFor([{ traitId: 'retired' as TraitId, tier: 1 }], DEFAULT_BALANCE.traits)).toEqual([]);
  });
});

describe('visibleRowsHeightPx', () => {
  it('does not cap a list that fits: five rows have nothing to scroll', () => {
    expect(visibleRowsHeightPx(Array<number>(VISIBLE_ROWS).fill(ONE_LINE), VISIBLE_ROWS)).toBeNull();
    expect(visibleRowsHeightPx([ONE_LINE], VISIBLE_ROWS)).toBeNull();
  });

  it('caps a longer list at the first five rows as drawn, so a two-line row is never sliced', () => {
    const heights = [ONE_LINE, TWO_LINES, ONE_LINE, TWO_LINES, ONE_LINE, ONE_LINE, ONE_LINE];
    // The fixed cap this replaces would have been 5 × 48 = 240, which cuts through the fifth row.
    expect(visibleRowsHeightPx(heights, VISIBLE_ROWS)).toBe(ONE_LINE * 3 + TWO_LINES * 2);
    expect(visibleRowsHeightPx(heights, VISIBLE_ROWS)).toBeGreaterThan(ONE_LINE * VISIBLE_ROWS);
  });

  it('does not cap before there is a layout to measure', () => {
    expect(visibleRowsHeightPx([0, 0, 0, 0, 0, 0], VISIBLE_ROWS)).toBeNull();
  });
});
