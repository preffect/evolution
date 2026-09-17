// **Activating pushes; roving replaces** (docs/ui/encyclopedia.md §11.5), over the whole panel: the real
// `EncyclopediaStateService`, the real list with its roving focus, and the entry page's own links. No spy — what a
// spy would prove is that a method was called, and every one of the three regressions on this seam called the right
// method from the wrong place.
//
// This contract has broken three times: ticket #447's review (no replace transition at all, so roving filled
// `ENCYCLOPEDIA_HISTORY_MAX` and evicted the location Back was there to return to), #448 round one (a latching flag
// that pushed on the next arrow) and round two (the flag cleared mid-press, so a press dragged off its row neither
// replaced nor pushed and Back lost the open entry). The entry page's prose, facts and See also links are three new
// activations on it, so the walk below ends where a reader expects rather than where a transition happened to leave
// them.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import { EncyclopediaComponent } from './encyclopedia.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { categoryLanding } from './format/navigation';
import type { EncyclopediaLocation } from './format/navigation';
import type { EntryId } from './model/entry-id';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaLinkTestId, encyclopediaRowTestId } from './test-ids';

const MITOCHONDRION = 'trait:mitochondrion' as EntryId;
const ENDOSYMBIOSIS = 'stage:endosymbiosis' as EntryId;
/** More roves than any Back walk below could absorb, and enough to show that none of them accumulates. */
const ROVE_STEPS = 12;

describe('the entry page on the push-and-replace seam (docs/ui/encyclopedia.md §11.5)', () => {
  let fixture: ComponentFixture<EncyclopediaComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function entryPage(): HTMLElement {
    return expectTestId(root(), ENCYCLOPEDIA_TEST_ID.entry);
  }

  /**
   * A row pressed as a browser presses one. The `pointerdown` is load-bearing: it is what tells the list that the
   * kit's report beside the press is that press's and not a rove, and a helper that omitted it would quietly turn
   * every push here into a replace (`encyclopedia-activation-press.directive.ts`).
   */
  function activateRow(entryId: EntryId): void {
    const element = expectTestId(root(), encyclopediaRowTestId(entryId));
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    element.dispatchEvent(new Event('pointerup', { bubbles: true }));
    element.click();
    fixture.detectChanges();
  }

  /** One arrow step down the list, pressed on the row that currently holds the focus, as §11.5's roving does. */
  function roveDown(): void {
    const entryId = state.location().entryId;
    if (entryId === null) throw new Error('roving starts from a row, so an entry must be shown');
    const row = expectTestId(root(), encyclopediaRowTestId(entryId));
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
  }

  function follow(entryId: EntryId, within: HTMLElement): void {
    expectTestId(within, encyclopediaLinkTestId(entryId)).click();
    fixture.detectChanges();
  }

  function goBack(): void {
    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.back).click();
    fixture.detectChanges();
  }

  function shownEntryId(): string | null {
    return queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.entry)?.getAttribute('data-entry-id') ?? null;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaComponent);
    fixture.detectChanges();
    activateRow(MITOCHONDRION);
  });

  it('walks Back through the pages the reader chose, in the order they chose them', () => {
    const landing: EncyclopediaLocation = categoryLanding(state.location().category);
    follow(ENDOSYMBIOSIS, entryPage());
    expect(shownEntryId()).toBe(ENDOSYMBIOSIS);

    const seeAlso = state.entry()!.seeAlso[0]!.entryId;
    follow(seeAlso, entryPage().querySelector('.see-also')!);
    expect(shownEntryId()).toBe(seeAlso);

    goBack();
    expect(shownEntryId()).toBe(ENDOSYMBIOSIS);
    goBack();
    expect(shownEntryId()).toBe(MITOCHONDRION);
    goBack();
    expect(state.location()).toEqual(landing);
    expect(state.canGoBack()).toBe(false);
  });

  /**
   * The regression #447's review caught, as a reader meets it: arrowing down the list is one act of looking. If each
   * step pushed, Back would walk the rows they skimmed instead of returning to where they came in — and after
   * `ENCYCLOPEDIA_HISTORY_MAX` steps it would not return there at all.
   */
  it('spends no history on roving, however far down the list the reader arrows', () => {
    const landing: EncyclopediaLocation = categoryLanding(state.location().category);
    for (let step = 0; step < ROVE_STEPS; step += 1) roveDown();
    expect(shownEntryId()).not.toBe(MITOCHONDRION);

    goBack();
    expect(state.location()).toEqual(landing);
    expect(state.canGoBack()).toBe(false);
  });

  /** A link followed after a rove still returns to the page the rove left the reader on, not to the row before it. */
  it('returns from a link to the entry the rove was showing when it was followed', () => {
    roveDown();
    const roved = shownEntryId();
    const link = state.entry()!.seeAlso[0]!.entryId;
    follow(link, entryPage().querySelector('.see-also')!);
    expect(shownEntryId()).toBe(link);

    goBack();
    expect(shownEntryId()).toBe(roved);
  });
});
