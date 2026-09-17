// The category landing over the real state service and the real registry, against the reference frame
// `qa/decisions/encyclopedia/encyclopedia-a-category-*.png` (docs/ui/encyclopedia.md §11.3).

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId } from '../../../testing/test-id-query';
import { EncyclopediaLandingComponent } from './encyclopedia-landing.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { ENCYCLOPEDIA_TITLE } from './encyclopedia-constants';
import { ENCYCLOPEDIA_CATEGORY_LABEL, ENCYCLOPEDIA_CATEGORY_SUMMARY } from './model/categories';
import { entriesIn } from './registry';
import { encyclopediaTileTestId } from './test-ids';

describe('EncyclopediaLandingComponent (docs/ui/encyclopedia.md §11.3)', () => {
  let fixture: ComponentFixture<EncyclopediaLandingComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function tiles(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('.tile')];
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaLandingComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaLandingComponent);
    fixture.detectChanges();
  });

  it('reads `Encyclopedia › <Category>` over the category heading and its one-line summary', () => {
    const category = state.location().category;
    expect(root().querySelector('nav')?.textContent).toContain(ENCYCLOPEDIA_TITLE);
    expect(root().querySelector('nav')?.textContent).toContain(ENCYCLOPEDIA_CATEGORY_LABEL[category]);
    expect(root().querySelector('.headline')?.textContent?.trim()).toBe(ENCYCLOPEDIA_CATEGORY_LABEL[category]);
    expect(root().querySelector('.summary')?.textContent?.trim()).toBe(ENCYCLOPEDIA_CATEGORY_SUMMARY[category]);
  });

  it('draws one tile per entry of the category, in registry order, each with its own test id', () => {
    const listed = entriesIn(state.location().category).flatMap((group) => group.entries);
    expect(tiles()).toHaveLength(listed.length);
    expect(listed.length).toBeGreaterThan(0);
    expect(tiles().map((tile) => tile.getAttribute('data-testid'))).toEqual(
      listed.map((entry) => encyclopediaTileTestId(entry.entryId)),
    );
  });

  it('carries the full title as the tile’s name, since the one on its face may be cut', () => {
    const first = entriesIn(state.location().category)[0]!.entries[0]!;
    const tile = expectTestId(root(), encyclopediaTileTestId(first.entryId));
    expect(tile.getAttribute('aria-label')).toBe(first.title);
    expect(tile.querySelector('.title')?.textContent?.trim()).toBe(first.title);
  });

  it('draws the entry’s first fact under the title, already formatted', () => {
    const first = entriesIn(state.location().category)[0]!.entries[0]!;
    const tile = expectTestId(root(), encyclopediaTileTestId(first.entryId));
    expect(tile.querySelector('.fact')?.textContent?.trim()).not.toBe('');
  });

  it('leads every tile with a glyph medallion in its well', () => {
    expect(root().querySelectorAll('.tile .well app-encyclopedia-glyph')).toHaveLength(tiles().length);
  });

  it('opens the entry when a tile is activated', () => {
    const first = entriesIn(state.location().category)[0]!.entries[0]!;
    expectTestId(root(), encyclopediaTileTestId(first.entryId)).click();
    expect(state.location().entryId).toBe(first.entryId);
  });

  it('is keyboard-reachable: every tile is a real button in the Tab order', () => {
    expect(tiles().every((tile) => tile.tagName === 'BUTTON' && tile.getAttribute('tabindex') === null)).toBe(true);
  });
});
