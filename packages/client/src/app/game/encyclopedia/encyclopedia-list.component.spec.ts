// The list column over the real state service and the real registry (docs/testing/tiers-and-builders.md §2.1): what
// it draws for a category, what it draws for a query, and what a row does when it is activated.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId, queryAllByTestId, queryByTestId } from '../../../testing/test-id-query';
import { EncyclopediaListComponent } from './encyclopedia-list.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { ENCYCLOPEDIA_RESULTS_LABEL } from './encyclopedia-constants';
import { entryCountIn, noMatchTextFor } from './format/list-view';
import { ENCYCLOPEDIA_CATEGORY_LABEL } from './model/categories';
import { entriesIn } from './registry';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaRowTestId } from './test-ids';

describe('EncyclopediaListComponent (docs/ui/encyclopedia.md §11.3, §11.5)', () => {
  let fixture: ComponentFixture<EncyclopediaListComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowIds(): readonly string[] {
    return [...root().querySelectorAll<HTMLElement>('ui-list-row')].map(
      (row) => row.getAttribute('data-item-id') ?? '',
    );
  }

  function headings(): readonly string[] {
    return [...root().querySelectorAll<HTMLElement>('ui-list-section')].map(
      (section) => section.querySelector('.header')?.textContent?.trim() ?? '',
    );
  }

  function type(query: string): void {
    state.setQuery(query);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaListComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaListComponent);
    fixture.detectChanges();
  });

  it('heads the column with the category and its entry count', () => {
    const category = state.location().category;
    expect(root().querySelector('.column-header .label')?.textContent?.trim()).toBe(
      ENCYCLOPEDIA_CATEGORY_LABEL[category],
    );
    expect(root().querySelector('.column-header .count')?.textContent?.trim()).toBe(
      String(entryCountIn(entriesIn(category))),
    );
  });

  it('draws every entry of the category, in registry order, each with its own test id', () => {
    const listed = entriesIn(state.location().category).flatMap((group) => group.entries);
    expect(rowIds()).toEqual(listed.map((entry) => entry.entryId));
    expect(listed.length).toBeGreaterThan(0);
    expect(queryByTestId(root(), encyclopediaRowTestId(listed[0]!.entryId))).not.toBeNull();
  });

  it('heads each group, since the category the panel opens on has more than one', () => {
    const groups = entriesIn(state.location().category);
    expect(groups.length).toBeGreaterThan(1);
    expect(headings()).toHaveLength(groups.length);
  });

  it('opens the entry when a row is activated, and marks it selected', () => {
    const first = entriesIn(state.location().category)[0]!.entries[0]!;
    expectTestId(root(), encyclopediaRowTestId(first.entryId)).click();
    fixture.detectChanges();
    expect(state.location().entryId).toBe(first.entryId);
    expect(expectTestId(root(), encyclopediaRowTestId(first.entryId)).getAttribute('aria-selected')).toBe('true');
  });

  it('shows the results under their category headers while a query matches', () => {
    type('mito');
    expect(state.results().length).toBeGreaterThan(0);
    expect(rowIds()).toEqual(state.results().map((result) => result.entryId));
    expect(headings()).toEqual(state.resultGroups().map((group) => ENCYCLOPEDIA_CATEGORY_LABEL[group.category]));
  });

  it('draws the strongest match first, which is the one Enter opens', () => {
    type('mito');
    expect(rowIds()[0]).toBe(state.results()[0]?.entryId);
  });

  it('re-heads the column for the results, since no category is selected while searching', () => {
    type('mito');
    expect(root().querySelector('.column-header .label')?.textContent?.trim()).toBe(ENCYCLOPEDIA_RESULTS_LABEL);
    expect(root().querySelector('.column-header .count')?.textContent?.trim()).toBe(String(state.results().length));
  });

  it('says `No match for "…"` and draws no row at all when nothing matches', () => {
    type('qqzz');
    expect(rowIds()).toEqual([]);
    expect(expectTestId(root(), ENCYCLOPEDIA_TEST_ID.noResults).textContent?.trim()).toBe(noMatchTextFor('qqzz'));
  });

  it('draws that line only when a query matched nothing, never over a category', () => {
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.noResults)).toBeNull();
    type('mito');
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.noResults)).toBeNull();
  });

  it('is one Tab stop over every section, so the arrows run through the whole column', () => {
    const stops = [...root().querySelectorAll<HTMLElement>('ui-list-row')].filter(
      (row) => row.getAttribute('tabindex') === '0',
    );
    expect(stops).toHaveLength(1);
  });

  it('leads every row with a glyph, so the column reads as one kind of thing', () => {
    expect(root().querySelectorAll('ui-list-row app-encyclopedia-glyph')).toHaveLength(rowIds().length);
  });

  it('keeps the list a single element, whichever state it is in', () => {
    expect(queryAllByTestId(root(), ENCYCLOPEDIA_TEST_ID.list)).toHaveLength(1);
    type('mito');
    expect(queryAllByTestId(root(), ENCYCLOPEDIA_TEST_ID.list)).toHaveLength(1);
  });
});
