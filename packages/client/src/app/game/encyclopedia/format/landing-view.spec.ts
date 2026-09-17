import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { ENCYCLOPEDIA_TITLE } from '../encyclopedia-constants';
import { ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_CATEGORY_LABEL } from '../model/categories';
import type { EntryLink, ResolvedEntry, ResolvedGroup } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import { ENTRY_GROUP, ENTRY_GROUP_LABEL } from '../model/groups';
import { entriesIn, resolveEntry } from '../registry';
import { encyclopediaTileTestId } from '../test-ids';
import { entryBreadcrumb, landingBreadcrumb, landingTilesFor } from './landing-view';

function link(entryId: string, title: string): EntryLink {
  return { entryId: entryId as EntryId, title };
}

const STAGES: ResolvedGroup = {
  group: ENTRY_GROUP.stages,
  entries: [link('stage:protocell', 'Protocell'), link('stage:endosymbiosis', 'Endosymbiosis')],
};

/** The registry's own resolve, so a tile's fact is the shipped formatter's and never a string typed here. */
function resolve(entryId: EntryId): ResolvedEntry {
  return resolveEntry(entryId, { balance: DEFAULT_BALANCE });
}

describe('landingBreadcrumb (docs/ui/encyclopedia.md §11.3)', () => {
  it('reads `Encyclopedia › <Category>`', () => {
    expect(landingBreadcrumb(ENCYCLOPEDIA_CATEGORY.entities).map((crumb) => crumb.text)).toEqual([
      ENCYCLOPEDIA_TITLE,
      ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.entities],
    ]);
  });

  it('makes neither crumb a link: one names no page, the other names the page already shown', () => {
    expect(landingBreadcrumb(ENCYCLOPEDIA_CATEGORY.entities).map((crumb) => crumb.target)).toEqual([null, null]);
  });
});

describe('entryBreadcrumb (docs/ui/encyclopedia.md §11.3)', () => {
  it('reads `<Category> › <Group>`', () => {
    const crumbs = entryBreadcrumb(ENCYCLOPEDIA_CATEGORY.evolutions, ENTRY_GROUP_LABEL[ENTRY_GROUP.metabolism]);
    expect(crumbs.map((crumb) => crumb.text)).toEqual([
      ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.evolutions],
      ENTRY_GROUP_LABEL[ENTRY_GROUP.metabolism],
    ]);
  });

  it('links the category crumb and only that one: it is the way back to the landing', () => {
    const crumbs = entryBreadcrumb(ENCYCLOPEDIA_CATEGORY.evolutions, ENTRY_GROUP_LABEL[ENTRY_GROUP.metabolism]);
    expect(crumbs.map((crumb) => crumb.target)).toEqual([ENCYCLOPEDIA_CATEGORY.evolutions, null]);
  });

  it('drops the second crumb in a category with no groups, rather than drawing an empty one', () => {
    const crumbs = entryBreadcrumb(ENCYCLOPEDIA_CATEGORY.abilities, null);
    expect(crumbs).toEqual([
      { text: ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.abilities], target: ENCYCLOPEDIA_CATEGORY.abilities },
    ]);
  });
});

describe('landingTilesFor (docs/ui/encyclopedia.md §11.3)', () => {
  it('draws one tile per entry, every group flattened into one grid, in list order', () => {
    expect(landingTilesFor([STAGES], resolve).map((tile) => tile.entryId)).toEqual([
      'stage:protocell',
      'stage:endosymbiosis',
    ]);
  });

  it('carries the entry title and its own test id', () => {
    const [first] = landingTilesFor([STAGES], resolve);
    expect(first?.title).toBe('Protocell');
    expect(first?.testId).toBe(encyclopediaTileTestId('stage:protocell' as EntryId));
  });

  it("takes the tile's one line from the entry's first fact, already formatted", () => {
    const entryId = 'stage:protocell' as EntryId;
    const valued = {
      ...resolve(entryId),
      headline: { key: 'mass', label: 'Starting mass', text: '20 mass', link: null },
    };
    const [first] = landingTilesFor([{ group: null, entries: [link(entryId, 'Protocell')] }], () => valued);
    expect(first?.fact).toBe('20 mass');
  });

  /**
   * A link fact's text is nothing but another entry's title, so a stage tile would read `Protocell` over
   * `Nucleoid Coil` — two titles with no way to tell which one the tile is (#460's review).
   */
  it('names a link-valued fact, since its text alone reads as a second title', () => {
    const entryId = 'stage:protocell' as EntryId;
    const headline = resolve(entryId).headline;
    expect(headline?.link).not.toBeNull();
    const [first] = landingTilesFor([{ group: null, entries: [link(entryId, 'Protocell')] }], resolve);
    expect(first?.fact).toBe(`${headline?.label}: ${headline?.text}`);
  });

  it('leaves the line off an entry with no fact rather than drawing an empty one', () => {
    const factless = { ...resolve('stage:protocell' as EntryId), headline: null };
    const [first] = landingTilesFor([{ group: null, entries: [link('stage:protocell', 'Protocell')] }], () => factless);
    expect(first?.fact).toBeNull();
  });

  it('draws every entry of a real category, so no shipped entry is left off its landing', () => {
    const groups = entriesIn(ENCYCLOPEDIA_CATEGORY.evolutions);
    const listed = groups.flatMap((group) => group.entries.map((entry) => entry.entryId));
    expect(landingTilesFor(groups, resolve).map((tile) => tile.entryId)).toEqual(listed);
    expect(listed.length).toBeGreaterThan(0);
  });
});
