// The trail's one branch that does something (docs/ui/encyclopedia.md §11.3, §11.5): a crumb with a target is a
// button that **pushes**, and a crumb without one is text. The trails themselves are `landing-view.spec.ts`'s.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import { EncyclopediaBreadcrumbComponent } from './encyclopedia-breadcrumb.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { entryBreadcrumb, landingBreadcrumb } from './format/landing-view';
import { ENCYCLOPEDIA_CATEGORY, ENCYCLOPEDIA_CATEGORY_LABEL } from './model/categories';
import { ENTRY_GROUP, ENTRY_GROUP_LABEL } from './model/groups';
import { entriesIn } from './registry';
import { encyclopediaCrumbTestId } from './test-ids';

const CATEGORY = ENCYCLOPEDIA_CATEGORY.evolutions;

describe('EncyclopediaBreadcrumbComponent (docs/ui/encyclopedia.md §11.3)', () => {
  let fixture: ComponentFixture<EncyclopediaBreadcrumbComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function show(crumbs: ReturnType<typeof landingBreadcrumb>): void {
    fixture.componentRef.setInput('crumbs', crumbs);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaBreadcrumbComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaBreadcrumbComponent);
  });

  it('draws a crumb with a target as a button carrying its own test id', () => {
    show(entryBreadcrumb(CATEGORY, ENTRY_GROUP_LABEL[ENTRY_GROUP.metabolism]));
    const crumb = expectTestId(root(), encyclopediaCrumbTestId(CATEGORY));
    expect(crumb.tagName).toBe('BUTTON');
    expect(crumb.textContent?.trim()).toBe(ENCYCLOPEDIA_CATEGORY_LABEL[CATEGORY]);
  });

  it('goes to that category when the crumb is activated, and pushes the location it left', () => {
    const entryId = entriesIn(CATEGORY)[0]!.entries[0]!.entryId;
    state.openEntry(entryId);
    show(entryBreadcrumb(CATEGORY, ENTRY_GROUP_LABEL[ENTRY_GROUP.metabolism]));

    expectTestId(root(), encyclopediaCrumbTestId(CATEGORY)).click();
    expect(state.location()).toEqual({ category: CATEGORY, entryId: null, sectionKey: null });
    expect(state.canGoBack()).toBe(true);

    state.goBack();
    expect(state.location().entryId).toBe(entryId);
  });

  it('draws a crumb with no target as text: it names the page already shown, so it goes nowhere', () => {
    show(landingBreadcrumb(CATEGORY));
    expect(queryByTestId(root(), encyclopediaCrumbTestId(CATEGORY))).toBeNull();
    expect(root().querySelectorAll('button')).toHaveLength(0);
    expect(root().querySelectorAll('.crumb')).toHaveLength(landingBreadcrumb(CATEGORY).length);
  });

  it('draws a separator between the crumbs and never before the first', () => {
    show(entryBreadcrumb(CATEGORY, ENTRY_GROUP_LABEL[ENTRY_GROUP.metabolism]));
    expect(root().querySelectorAll('.separator')).toHaveLength(1);
    show(entryBreadcrumb(ENCYCLOPEDIA_CATEGORY.abilities, null));
    expect(root().querySelectorAll('.separator')).toHaveLength(0);
  });

  /** The old guard counted separators and never read one, so any character would have passed (#460's review). */
  it('draws the chevron \u00a711.3 writes, not merely some separator', () => {
    show(entryBreadcrumb(CATEGORY, ENTRY_GROUP_LABEL[ENTRY_GROUP.metabolism]));
    expect(root().querySelector('.separator')?.textContent?.trim()).toBe('\u203a');
  });

  it('names the trail for a screen reader, so the crumbs are not read as loose words', () => {
    show(landingBreadcrumb(CATEGORY));
    expect(root().querySelector('nav')?.getAttribute('aria-label')).toBe('Breadcrumb');
  });
});
