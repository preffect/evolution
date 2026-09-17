// A facts table of the entry page (docs/ui/encyclopedia.md §11.4): the `label` header, a link-valued row and a plain
// one, the tier columns with their caption and tint, and the push a fact's link makes.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import { EncyclopediaFactsComponent } from './encyclopedia-facts.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { FACT_LIST_SEPARATOR } from './facts/resolve-prose';
import type { EncyclopediaFactRow } from './format/entry-view';
import type { EntryId } from './model/entry-id';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaLinkTestId } from './test-ids';

const CILIA = 'trait:cilia' as EntryId;
const PROTOCELL = 'stage:protocell' as EntryId;
const HEADING = 'Unlock and ladder';

const LINK_ROW: EncyclopediaFactRow = {
  rowId: 'requires',
  name: 'Requires',
  values: [`Cilia Fringe${FACT_LIST_SEPARATOR}Protocell`],
  links: [
    { entryId: CILIA, title: 'Cilia Fringe' },
    { entryId: PROTOCELL, title: 'Protocell' },
  ],
};

const VALUE_ROW: EncyclopediaFactRow = {
  rowId: 'bacteriaToUnlock',
  name: 'Bacteria eaten to unlock',
  values: ['10'],
  links: [],
};

describe('EncyclopediaFactsComponent (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<EncyclopediaFactsComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaFactsComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaFactsComponent);
    fixture.componentRef.setInput('heading', HEADING);
    fixture.componentRef.setInput('rows', [LINK_ROW, VALUE_ROW]);
    fixture.detectChanges();
  });

  it('sits under its header, as the table §11.6 names', () => {
    expect(root().querySelector('.heading')?.textContent?.trim()).toBe(HEADING);
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.facts)?.tagName).toBe('TABLE');
    expect([...root().querySelectorAll('tbody th.name')].map((cell) => cell.textContent?.trim())).toEqual([
      LINK_ROW.name,
      VALUE_ROW.name,
    ]);
  });

  it('draws every target of a link fact as its own link, joined, and a plain value as text', () => {
    const cells = [...root().querySelectorAll('tbody td.value')];
    expect(cells[0]?.querySelectorAll('.link')).toHaveLength(2);
    // Exactly, with no trim: a newline in the template between a link and the separator renders as a space, so the
    // row would read `Cilia Fringe , Protocell` on screen while a trimmed comparison stayed green.
    expect(cells[0]?.textContent).toBe(`Cilia Fringe${FACT_LIST_SEPARATOR}Protocell`);
    expect(cells[1]?.querySelectorAll('.link')).toHaveLength(0);
    expect(cells[1]?.textContent?.trim()).toBe('10');
  });

  it('pushes the entry a fact link names, so Back returns to the page it was read from', () => {
    expect(state.canGoBack()).toBe(false);
    expectTestId(root(), encyclopediaLinkTestId(PROTOCELL)).click();
    expect(state.location().entryId).toBe(PROTOCELL);
    expect(state.canGoBack()).toBe(true);
  });

  it('grows the tier header row with its caption and tints exactly the column it is told to', () => {
    fixture.componentRef.setInput('rows', [
      { rowId: 'speedMultiplier', name: 'speed', values: ['+10 %', '+20 %'], links: [] },
    ]);
    fixture.componentRef.setInput('columns', ['I', 'II']);
    fixture.componentRef.setInput('columnsCaption', 'You own II');
    fixture.componentRef.setInput('highlightColumn', 1);
    fixture.detectChanges();
    expect(root().querySelector('thead .name')?.textContent?.trim()).toBe('You own II');
    expect([...root().querySelectorAll('thead .value')].map((cell) => cell.textContent?.trim())).toEqual(['I', 'II']);
    const tinted = [...root().querySelectorAll('td.value[data-highlighted]')].map((cell) => cell.textContent?.trim());
    expect(tinted).toEqual(['+20 %']);
  });

  it('draws no header row at all when a table has no columns, which is every table but the tier one', () => {
    expect(root().querySelector('thead')).toBeNull();
  });

  /**
   * §11.4's wrapping ruling, at the seam where it is asked for. The kit's single-line default does not narrow a
   * column, it widens the table — which pushed the page's facts out through the panel rim on 12 of 28 entries
   * (PR #471). That the wrapped table then *fits* is a rendered frame's answer, not jsdom's: `qa/evidence/pr-471/`.
   */
  it('asks the kit to wrap, since a value here can be several links or a wide unit', () => {
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.facts)?.getAttribute('data-wrap-values')).toBe('true');
  });
});
