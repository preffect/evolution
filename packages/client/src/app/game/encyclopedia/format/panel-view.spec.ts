import { describe, expect, it } from 'vitest';
import { ENCYCLOPEDIA_CATEGORY } from '../model/categories';
import type { EntryId } from '../model/entry-id';
import { categoryLanding, entryLocation } from './navigation';
import { ENCYCLOPEDIA_LOCATION_SEPARATOR, locationAttributeFor } from './panel-view';

describe('locationAttributeFor (docs/ui/encyclopedia.md §11.6)', () => {
  it('writes `<category>|<entryId>` on an entry', () => {
    expect(locationAttributeFor(entryLocation('trait:mitochondrion' as EntryId))).toBe(
      `${ENCYCLOPEDIA_CATEGORY.evolutions}${ENCYCLOPEDIA_LOCATION_SEPARATOR}trait:mitochondrion`,
    );
  });

  it('keeps the separator on a landing, so the shape never changes and a reader never has to branch', () => {
    expect(locationAttributeFor(categoryLanding(ENCYCLOPEDIA_CATEGORY.world))).toBe(
      `${ENCYCLOPEDIA_CATEGORY.world}${ENCYCLOPEDIA_LOCATION_SEPARATOR}`,
    );
  });

  it('says nothing about the section an anchor named: the attribute is where the reader is, not how deep', () => {
    const anchored = entryLocation('trait:mitochondrion' as EntryId, 'tier_2');
    expect(locationAttributeFor(anchored)).toBe(locationAttributeFor(entryLocation('trait:mitochondrion' as EntryId)));
  });
});
