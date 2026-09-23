// docs/ui/encyclopedia.md §11.5: every move but Back pushes the location it left, Back pops, a move to the location
// already shown pushes nothing, the stack is capped, and the rail never offers a category with no entries.

import { describe, expect, it } from 'vitest';
import { DEFAULT_ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_HISTORY_MAX } from '../encyclopedia-constants';
import { ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_CATEGORY_ORDER, type EncyclopediaCategory } from '../model/categories';
import type { EntryId } from '../model/entry-id';
import {
  canGoBack,
  categoryLanding,
  isLandingOf,
  defaultLocation,
  entryLocation,
  goBack,
  goTo,
  goToReplacing,
  initialNavigation,
  isSameLocation,
  listedCategories,
  type EncyclopediaLocation,
  type EncyclopediaNavigation,
} from './navigation';

const CILIA: EntryId = 'trait:cilia';
const MITOCHONDRION: EntryId = 'trait:mitochondrion';
const BASICS_LANDING = categoryLanding(ENCYCLOPEDIA_CATEGORY.basics);

/** A distinct location per index, so a stack of them can be told apart end to end. */
function sectionAt(index: number): EncyclopediaLocation {
  return entryLocation(CILIA, `section_${index}`);
}

function walk(start: EncyclopediaNavigation, locations: readonly EncyclopediaLocation[]): EncyclopediaNavigation {
  return locations.reduce(goTo, start);
}

describe('locations', () => {
  it('takes a landing’s category from the rail and an entry’s from the entry, so a link switches the rail', () => {
    expect(categoryLanding(ENCYCLOPEDIA_CATEGORY.world)).toEqual({
      category: ENCYCLOPEDIA_CATEGORY.world,
      entryId: null,
      sectionKey: null,
    });
    expect(entryLocation(CILIA)).toEqual({
      category: ENCYCLOPEDIA_CATEGORY.evolutions,
      entryId: CILIA,
      sectionKey: null,
    });
  });

  it('tells two sections of one page apart, so an anchor is a move of its own', () => {
    expect(isSameLocation(entryLocation(CILIA, 'tier_2'), entryLocation(CILIA, 'tier_2'))).toBe(true);
    expect(isSameLocation(entryLocation(CILIA, 'tier_2'), entryLocation(CILIA, 'tier_3'))).toBe(false);
    expect(isSameLocation(entryLocation(CILIA), entryLocation(CILIA, 'tier_2'))).toBe(false);
    expect(isSameLocation(entryLocation(CILIA), entryLocation(MITOCHONDRION))).toBe(false);
  });
});

describe('goTo', () => {
  it('pushes the location it leaves, newest last', () => {
    const navigation = walk(initialNavigation(BASICS_LANDING), [entryLocation(CILIA), entryLocation(MITOCHONDRION)]);

    expect(navigation.location).toEqual(entryLocation(MITOCHONDRION));
    expect(navigation.history).toEqual([BASICS_LANDING, entryLocation(CILIA)]);
  });

  it('pushes nothing for a move to the location already shown', () => {
    const navigation = goTo(initialNavigation(BASICS_LANDING), entryLocation(CILIA));

    expect(goTo(navigation, entryLocation(CILIA))).toBe(navigation);
    expect(goTo(navigation, entryLocation(CILIA)).history).toEqual([BASICS_LANDING]);
  });
});

describe('goBack', () => {
  it('pops the newest pushed location and leaves the rest of the stack', () => {
    const navigation = goBack(
      walk(initialNavigation(BASICS_LANDING), [entryLocation(CILIA), entryLocation(MITOCHONDRION)]),
    );

    expect(navigation.location).toEqual(entryLocation(CILIA));
    expect(navigation.history).toEqual([BASICS_LANDING]);
    expect(canGoBack(navigation)).toBe(true);
  });

  it('walks a whole stack back to where it started and then stops there', () => {
    const start = initialNavigation(BASICS_LANDING);
    const navigation = goBack(goBack(walk(start, [entryLocation(CILIA), entryLocation(MITOCHONDRION)])));

    expect(navigation.location).toEqual(BASICS_LANDING);
    expect(canGoBack(navigation)).toBe(false);
    expect(goBack(navigation)).toBe(navigation);
  });

  it('is a no-op at the empty boundary: a fresh navigation has nowhere to go back to', () => {
    const start = initialNavigation(BASICS_LANDING);

    expect(canGoBack(start)).toBe(false);
    expect(goBack(start)).toBe(start);
    expect(goBack(start).location).toEqual(BASICS_LANDING);
  });
});

describe('goToReplacing', () => {
  it('shows the new location without touching the stack, so roving focus cannot spend the history', () => {
    const start = goTo(initialNavigation(BASICS_LANDING), entryLocation(CILIA));
    const roved = Array.from({ length: ENCYCLOPEDIA_HISTORY_MAX * 2 }, (_unused, index) => sectionAt(index)).reduce(
      goToReplacing,
      start,
    );

    expect(roved.location).toEqual(sectionAt(ENCYCLOPEDIA_HISTORY_MAX * 2 - 1));
    expect(roved.history).toEqual([BASICS_LANDING]);
    expect(canGoBack(roved)).toBe(true);
    expect(goBack(roved).location).toEqual(BASICS_LANDING);
  });

  it('changes nothing at all for a replace onto the location already shown', () => {
    const navigation = goTo(initialNavigation(BASICS_LANDING), entryLocation(CILIA));

    expect(goToReplacing(navigation, entryLocation(CILIA))).toBe(navigation);
  });
});

describe('the history cap', () => {
  it('holds exactly ENCYCLOPEDIA_HISTORY_MAX locations once full, and drops the oldest for the next one', () => {
    const start = initialNavigation(sectionAt(0));
    const moves = Array.from({ length: ENCYCLOPEDIA_HISTORY_MAX }, (_unused, index) => sectionAt(index + 1));

    const full = walk(start, moves);
    expect(full.history).toHaveLength(ENCYCLOPEDIA_HISTORY_MAX);
    expect(full.history[0]).toEqual(sectionAt(0));

    const overflowed = goTo(full, sectionAt(ENCYCLOPEDIA_HISTORY_MAX + 1));
    expect(overflowed.history).toHaveLength(ENCYCLOPEDIA_HISTORY_MAX);
    expect(overflowed.history[0]).toEqual(sectionAt(1));
    expect(overflowed.history.at(-1)).toEqual(sectionAt(ENCYCLOPEDIA_HISTORY_MAX));
  });

  it('still walks back through every location it kept, and the dropped one is gone for good', () => {
    const start = initialNavigation(sectionAt(0));
    const moves = Array.from({ length: ENCYCLOPEDIA_HISTORY_MAX + 1 }, (_unused, index) => sectionAt(index + 1));

    let navigation = walk(start, moves);
    for (let step = 0; step < ENCYCLOPEDIA_HISTORY_MAX; step += 1) navigation = goBack(navigation);

    expect(navigation.location).toEqual(sectionAt(1));
    expect(canGoBack(navigation)).toBe(false);
  });
});

describe('listedCategories', () => {
  it('keeps the declared order and drops every category with no entry', () => {
    const nonEmpty: readonly EncyclopediaCategory[] = [ENCYCLOPEDIA_CATEGORY.world, ENCYCLOPEDIA_CATEGORY.entities];

    expect(listedCategories((category) => nonEmpty.includes(category))).toEqual([
      ENCYCLOPEDIA_CATEGORY.entities,
      ENCYCLOPEDIA_CATEGORY.world,
    ]);
  });

  it('lists every category once they all have entries, and none while none do', () => {
    expect(listedCategories(() => true)).toEqual(ENCYCLOPEDIA_CATEGORY_ORDER);
    expect(listedCategories(() => false)).toEqual([]);
  });
});

describe('defaultLocation', () => {
  it('opens on the default category once it has entries', () => {
    const listed = listedCategories(() => true);

    expect(defaultLocation(listed)).toEqual(categoryLanding(DEFAULT_ENCYCLOPEDIA_CATEGORY));
  });

  it('opens on the first listed category while the default one is still empty', () => {
    const listed: readonly EncyclopediaCategory[] = [ENCYCLOPEDIA_CATEGORY.evolutions, ENCYCLOPEDIA_CATEGORY.world];

    expect(defaultLocation(listed)).toEqual(categoryLanding(ENCYCLOPEDIA_CATEGORY.evolutions));
  });

  it('prefers the default category over the first listed one, wherever in the order it sits', () => {
    // `DEFAULT_ENCYCLOPEDIA_CATEGORY` is also ENCYCLOPEDIA_CATEGORY_ORDER[0] today, so every other case here reads the
    // same under "prefers the default" and under "takes the first listed". This is the one that tells them apart, and
    // it is the case of a default category that is not the first listed one.
    const listed: readonly EncyclopediaCategory[] = [ENCYCLOPEDIA_CATEGORY.entities, DEFAULT_ENCYCLOPEDIA_CATEGORY];

    expect(defaultLocation(listed)).toEqual(categoryLanding(DEFAULT_ENCYCLOPEDIA_CATEGORY));
  });
});

describe('isLandingOf', () => {
  it('is the category’s landing itself, and neither another category’s nor an entry in it', () => {
    expect(isLandingOf(BASICS_LANDING, ENCYCLOPEDIA_CATEGORY.basics)).toBe(true);
    expect(isLandingOf(BASICS_LANDING, ENCYCLOPEDIA_CATEGORY.world)).toBe(false);
    expect(isLandingOf({ ...BASICS_LANDING, entryId: 'x' as never }, ENCYCLOPEDIA_CATEGORY.basics)).toBe(false);
  });
});
