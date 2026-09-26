// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_CATEGORY_LABEL, type EncyclopediaCategory } from '../model/categories';
import { encyclopediaCategoryTestId } from '../test-ids';
import { categoryFromItemId, railRowsFor } from './rail-view';

const LISTED: readonly EncyclopediaCategory[] = [ENCYCLOPEDIA_CATEGORY.evolutions, ENCYCLOPEDIA_CATEGORY.world];

const COUNTS: Readonly<Partial<Record<EncyclopediaCategory, number>>> = {
  [ENCYCLOPEDIA_CATEGORY.evolutions]: 28,
  [ENCYCLOPEDIA_CATEGORY.world]: 8,
};

function countIn(category: EncyclopediaCategory): number {
  return COUNTS[category] ?? 0;
}

describe('railRowsFor (docs/ui/encyclopedia.md §11.3)', () => {
  it('draws one row per listed category, in the order it was given, and nothing else', () => {
    expect(railRowsFor(LISTED, countIn).map((row) => row.category)).toEqual([...LISTED]);
  });

  it('labels and counts each row from the category, not from its position', () => {
    const [evolutions] = railRowsFor(LISTED, countIn);
    expect(evolutions).toEqual({
      category: ENCYCLOPEDIA_CATEGORY.evolutions,
      label: ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.evolutions],
      count: 28,
      testId: encyclopediaCategoryTestId(ENCYCLOPEDIA_CATEGORY.evolutions),
    });
  });

  it('takes the count from `countIn` on every call, so a row can never hold a typed number', () => {
    expect(railRowsFor(LISTED, () => 3).map((row) => row.count)).toEqual([3, 3]);
  });

  it('lists nothing when nothing is listed: an empty registry draws an empty rail, never a stale one', () => {
    expect(railRowsFor([], countIn)).toEqual([]);
  });
});

describe('categoryFromItemId (docs/ui/encyclopedia.md §11.3)', () => {
  it('answers with the listed category an item id names', () => {
    expect(categoryFromItemId(ENCYCLOPEDIA_CATEGORY.world, LISTED)).toBe(ENCYCLOPEDIA_CATEGORY.world);
  });

  it('refuses a category that is real but not listed, so a rail row cannot open an empty landing', () => {
    expect(categoryFromItemId(ENCYCLOPEDIA_CATEGORY.basics, LISTED)).toBeNull();
  });

  it('refuses a string that is no category at all, and the kit’s null selection', () => {
    expect(categoryFromItemId('trait:mitochondrion', LISTED)).toBeNull();
    expect(categoryFromItemId(null, LISTED)).toBeNull();
  });
});
