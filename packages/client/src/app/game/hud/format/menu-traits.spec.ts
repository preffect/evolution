import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TRAIT_CATALOG, type OwnedTrait, type TraitId } from '@evolution/shared';
import { menuTraitRowsFor, traitEntryId } from './menu-traits';
import { describeTierModifiers } from './trait-effects';

const NUCLEOID = 'nucleoid' as TraitId;
const MITOCHONDRION = 'mitochondrion' as TraitId;

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
