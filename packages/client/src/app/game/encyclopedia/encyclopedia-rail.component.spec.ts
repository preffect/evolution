// The rail against a stubbed state (docs/testing/tiers-and-builders.md §2.1). The stub is here for one reason: the
// shipped registry lists a single category until #361 and #362 land, and a rail with one row cannot show that
// activating pushes while roving replaces — the move that tells them apart would be a move to the row already
// selected, which §11.5 says changes nothing at all. The counts stay the real registry's.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectTestId } from '../../../testing/test-id-query';
import { EncyclopediaRailComponent } from './encyclopedia-rail.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { categoryLanding } from './format/navigation';
import { ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_CATEGORY_LABEL, type EncyclopediaCategory } from './model/categories';
import { entriesIn } from './registry';
import { encyclopediaCategoryTestId } from './test-ids';

const LISTED: readonly EncyclopediaCategory[] = [ENCYCLOPEDIA_CATEGORY.evolutions, ENCYCLOPEDIA_CATEGORY.world];

class StateStub {
  readonly categories = LISTED;
  readonly location = signal(categoryLanding(ENCYCLOPEDIA_CATEGORY.evolutions));
  readonly query = signal('');
  readonly selectCategory = vi.fn<(category: EncyclopediaCategory) => void>();
  readonly focusCategory = vi.fn<(category: EncyclopediaCategory) => void>();
}

describe('EncyclopediaRailComponent (docs/ui/encyclopedia.md §11.3, §11.5)', () => {
  let fixture: ComponentFixture<EncyclopediaRailComponent>;
  let state: StateStub;

  function rows(): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ui-rail-item')];
  }

  function row(category: EncyclopediaCategory): HTMLElement {
    return expectTestId(fixture.nativeElement as HTMLElement, encyclopediaCategoryTestId(category));
  }

  /** A press as a browser sends it: `pointerdown`, then the `click` the kit selects on. */
  function clickRow(category: EncyclopediaCategory): void {
    const element = row(category);
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    element.click();
    fixture.detectChanges();
  }

  function arrowDownFrom(category: EncyclopediaCategory): void {
    row(category).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    state = new StateStub();
    TestBed.configureTestingModule({
      imports: [EncyclopediaRailComponent],
      providers: [{ provide: EncyclopediaStateService, useValue: state as unknown as EncyclopediaStateService }],
    });
    fixture = TestBed.createComponent(EncyclopediaRailComponent);
    fixture.detectChanges();
  });

  it('draws one row per listed category, labelled and counted from the registry', () => {
    expect(rows()).toHaveLength(LISTED.length);
    expect(row(ENCYCLOPEDIA_CATEGORY.evolutions).textContent).toContain(
      ENCYCLOPEDIA_CATEGORY_LABEL[ENCYCLOPEDIA_CATEGORY.evolutions],
    );
    const evolutionEntries = entriesIn(ENCYCLOPEDIA_CATEGORY.evolutions).flatMap((group) => group.entries);
    expect(row(ENCYCLOPEDIA_CATEGORY.evolutions).textContent).toContain(String(evolutionEntries.length));
    expect(evolutionEntries.length).toBeGreaterThan(0);
  });

  it('marks the category being read as selected', () => {
    expect(row(ENCYCLOPEDIA_CATEGORY.evolutions).getAttribute('aria-selected')).toBe('true');
    expect(row(ENCYCLOPEDIA_CATEGORY.world).getAttribute('aria-selected')).toBe('false');
  });

  it('drops the selection entirely while a query is running, since the results replace the category', () => {
    state.query.set('mito');
    fixture.detectChanges();
    expect(rows().map((element) => element.getAttribute('aria-selected'))).toEqual(['false', 'false']);
  });

  it('pushes when a row is activated with the pointer, so Back returns to where the reader came from', () => {
    clickRow(ENCYCLOPEDIA_CATEGORY.world);
    expect(state.selectCategory).toHaveBeenCalledWith(ENCYCLOPEDIA_CATEGORY.world);
    expect(state.focusCategory).not.toHaveBeenCalled();
  });

  it('replaces when the roving focus moves, so arrowing the rail never spends the back stack', () => {
    arrowDownFrom(ENCYCLOPEDIA_CATEGORY.evolutions);
    expect(state.focusCategory).toHaveBeenCalledWith(ENCYCLOPEDIA_CATEGORY.world);
    expect(state.selectCategory).not.toHaveBeenCalled();
  });

  it('does not let one pointer press make the arrow that follows it push as well', () => {
    clickRow(ENCYCLOPEDIA_CATEGORY.world);
    state.selectCategory.mockClear();
    arrowDownFrom(ENCYCLOPEDIA_CATEGORY.world);
    arrowDownFrom(ENCYCLOPEDIA_CATEGORY.evolutions);
    expect(state.selectCategory).not.toHaveBeenCalled();
  });

  it('is one Tab stop: exactly one row is reachable by Tab, the rest by the arrows', () => {
    expect(rows().filter((element) => element.getAttribute('tabindex') === '0')).toHaveLength(1);
  });
});
