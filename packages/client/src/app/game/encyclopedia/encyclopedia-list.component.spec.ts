// The list column over the real state service and the real registry (docs/testing/tiers-and-builders.md §2.1): what
// it draws for a category, what it draws for a query, and — the part §11.5 is strictest about — which of its moves
// push the back stack and which only replace.
//
// **The back stack is walked through the real service, never asserted against a spy.** A spy says which method was
// called; it cannot say where Back lands, which is the whole promise. So the cases below drive a sequence of roves
// and activations and then walk `goBack()` to the end, asserting the reader arrives where they came from.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId, queryAllByTestId, queryByTestId } from '../../../testing/test-id-query';
import { EncyclopediaListComponent } from './encyclopedia-list.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { ENCYCLOPEDIA_RESULTS_LABEL } from './encyclopedia-constants';
import { entryCountIn, noMatchTextFor } from './format/list-view';
import { ENCYCLOPEDIA_CATEGORY_LABEL } from './model/categories';
import type { EntryId } from './model/entry-id';
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

  /** The entries of the category the panel opens on, in the order the column draws them. */
  function listedEntryIds(): readonly EntryId[] {
    return entriesIn(state.location().category).flatMap((group) => group.entries.map((entry) => entry.entryId));
  }

  function row(entryId: EntryId): HTMLElement {
    return expectTestId(root(), encyclopediaRowTestId(entryId));
  }

  /**
   * A press as a browser sends it — **all three events, in order**: `pointerdown`, `pointerup`, then the `click` the
   * kit selects on. The `pointerup` matters: it is dispatched before the click, so a handler that ended the press on
   * it would already have run by the time the kit reports, and a helper that omits it makes that unanswerable
   * (#460's R6, docs/ui/encyclopedia.md §11.5).
   */
  function clickRow(entryId: EntryId): void {
    const element = row(entryId);
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    element.dispatchEvent(new Event('pointerup', { bubbles: true }));
    element.click();
    fixture.detectChanges();
  }

  /** One press that slips off the column and comes back before it is released. */
  function pressSlippingOffAndBack(entryId: EntryId): void {
    const element = row(entryId);
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.list).dispatchEvent(new Event('pointerleave', { bubbles: false }));
    element.dispatchEvent(new Event('pointerup', { bubbles: true }));
    element.click();
    fixture.detectChanges();
  }

  function pressKeyOn(entryId: EntryId, key: string): void {
    row(entryId).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  /** Every location Back walks through from here, ending where it can go no further. */
  function walkBack(): readonly (EntryId | null)[] {
    const visited: (EntryId | null)[] = [];
    while (state.canGoBack()) {
      state.goBack();
      visited.push(state.location().entryId);
    }
    fixture.detectChanges();
    return visited;
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
    const first = listedEntryIds()[0]!;
    clickRow(first);
    expect(state.location().entryId).toBe(first);
    expect(row(first).getAttribute('aria-selected')).toBe('true');
  });

  describe('activating pushes, roving replaces (§11.5)', () => {
    it('pages through entries as the roving focus moves, since selection follows focus here', () => {
      const [first, second] = listedEntryIds();
      pressKeyOn(first!, 'ArrowDown');
      expect(state.location().entryId).toBe(second);
    });

    it('spends no back stack on the arrows, however far down the column they run', () => {
      const listed = listedEntryIds();
      expect(listed.length).toBeGreaterThan(2);
      for (const [index, entryId] of listed.slice(0, -1).entries()) {
        pressKeyOn(entryId, 'ArrowDown');
        expect(state.location().entryId).toBe(listed[index + 1]);
      }
      expect(state.canGoBack()).toBe(false);
    });

    it('pushes when a row is clicked, so Back returns to the landing the reader came from', () => {
      clickRow(listedEntryIds()[1]!);
      expect(state.canGoBack()).toBe(true);
      expect(walkBack()).toEqual([null]);
    });

    it.each([['Enter'], [' ']])(
      'pushes on %j, which is an activation and not the rove that put focus on the row',
      (key) => {
        const second = listedEntryIds()[1]!;
        pressKeyOn(second, key);
        expect(state.location().entryId).toBe(second);
        expect(walkBack()).toEqual([null]);
      },
    );

    /**
     * The case the ticket says has bitten three times, driven end to end: a long run of roves with activations
     * among them, then Back walked to the end. Back must visit only the locations the reader *chose*, in reverse —
     * the landing they started on and the row they had open when they chose the next one — and never the fifty
     * places the arrows merely rested on.
     */
    it('walks Back through the locations the reader chose, and none of the ones they arrowed past', () => {
      const [first, second, third, fourth] = listedEntryIds();
      clickRow(second!); //                     push: landing
      pressKeyOn(second!, 'ArrowDown'); //      replace → third
      pressKeyOn(third!, 'ArrowUp'); //         replace → second
      pressKeyOn(second!, 'ArrowDown'); //      replace → third
      pressKeyOn(third!, 'Enter'); //           activation of the row already shown: nothing to push
      clickRow(first!); //                      push: third
      pressKeyOn(first!, 'ArrowDown'); //       replace → second
      clickRow(fourth!); //                     push: second

      expect(state.location().entryId).toBe(fourth);
      expect(walkBack()).toEqual([second, third, null]);
    });

    it('still pushes when one press slips off the column and comes back before it is released', () => {
      pressSlippingOffAndBack(listedEntryIds()[1]!);
      expect(walkBack()).toEqual([null]);
    });

    it('leaves the arrows replacing after a press, rather than latching the activation into the next one', () => {
      const [first, second, third] = listedEntryIds();
      clickRow(first!);
      pressKeyOn(first!, 'ArrowDown');
      pressKeyOn(second!, 'ArrowDown');
      expect(state.location().entryId).toBe(third);
      expect(walkBack()).toEqual([null]);
    });
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
