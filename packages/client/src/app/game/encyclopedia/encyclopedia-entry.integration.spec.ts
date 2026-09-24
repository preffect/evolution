// **Activating pushes; roving replaces** (docs/ui/encyclopedia.md §11.5), over the whole panel: the real
// `EncyclopediaStateService`, the real list with its roving focus, and the entry page's own links. No spy — what a
// spy would prove is that a method was called, and every one of the three regressions on this seam called the right
// method from the wrong place.
//
// This contract has broken three times: ticket #447's review (no replace transition at all, so roving filled
// `ENCYCLOPEDIA_HISTORY_MAX` and evicted the location Back was there to return to), #448 round one (a latching flag
// that pushed on the next arrow) and round two (the flag cleared mid-press, so a press dragged off its row neither
// replaced nor pushed and Back lost the open entry). The entry page adds three new activations to it — a prose link,
// a fact's link and a See also chip — so the walk below follows **one of each** and then goes back through them.
//
// **Each follow names the region it clicks in, and that is not tidiness.** `encyclopedia-link-<entryId>` is carried by
// *every* link to that entry (§11.6), so a page that links Endosymbiosis from both its facts table and its prose has
// two of them, the table's first in document order. A `querySelector` over the whole page therefore always pressed
// the fact link, and a first draft of this spec went green with the prose link's own transition broken.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import { recordingPreviewProvider } from '../../../testing/fake-preview-handle';
import { EncyclopediaComponent } from './encyclopedia.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { categoryLanding, type EncyclopediaLocation } from './format/navigation';
import { ENCYCLOPEDIA_CATEGORY } from './model/categories';
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

  /** The region a link is pressed in, so a page carrying the same link twice cannot answer for the wrong one. */
  function region(selector: string): HTMLElement {
    const element = entryPage().querySelector<HTMLElement>(selector);
    if (element === null) throw new Error(`the open entry has no ${selector}`);
    return element;
  }

  /**
   * A row pressed as a browser presses one — `pointerdown`, `pointerup`, `click`, in that order. Since ticket #622 the
   * kit reports the activation itself and nothing reads the first two; they stay so the press is driven as a browser
   * drives it (docs/ui/encyclopedia.md §11.5).
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

  /** The first link of a region, whichever entry it names: what a reader's eye would land on first. */
  function firstLinkTargetIn(within: HTMLElement): EntryId {
    const link = within.querySelector<HTMLElement>('[data-testid^="encyclopedia-link-"]');
    if (link === null) throw new Error('the region holds no link');
    return link.getAttribute('data-testid')!.replace('encyclopedia-link-', '') as EntryId;
  }

  function goBack(): void {
    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.back).click();
    fixture.detectChanges();
  }

  function shownEntryId(): string | null {
    return queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.entry)?.getAttribute('data-entry-id') ?? null;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaComponent], providers: [recordingPreviewProvider()] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaComponent);
    fixture.detectChanges();
    // The panel opens on Basics; the trait rows are Evolution's. Focusing the rail there replaces rather than pushes,
    // so the landing Back returns to is Evolution's and nothing is in the history before the first row.
    state.focusCategory(ENCYCLOPEDIA_CATEGORY.evolutions);
    fixture.detectChanges();
    activateRow(MITOCHONDRION);
  });

  it('walks Back through the pages the reader chose, in the order they chose them', () => {
    const landing: EncyclopediaLocation = categoryLanding(state.location().category);

    // A **prose** link, taken from the paragraph rather than from the facts table that names the same entry above it.
    follow(ENDOSYMBIOSIS, region('app-encyclopedia-prose'));
    expect(shownEntryId()).toBe(ENDOSYMBIOSIS);

    // A **fact's** link, from the first facts table of the page it landed on.
    const factTarget = firstLinkTargetIn(region('app-encyclopedia-facts'));
    follow(factTarget, region('app-encyclopedia-facts'));
    expect(shownEntryId()).toBe(factTarget);

    // A **See also** chip.
    const seeAlsoTarget = firstLinkTargetIn(region('.see-also'));
    follow(seeAlsoTarget, region('.see-also'));
    expect(shownEntryId()).toBe(seeAlsoTarget);

    goBack();
    expect(shownEntryId()).toBe(factTarget);
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

  /**
   * A link followed after a rove still returns to the page the rove left the reader on, not to the row before it.
   * Which *kind* of link it is does not matter here — the walk above takes one of each — so this one takes the first
   * link on the page, whichever region holds it.
   */
  it('returns from a link to the entry the rove was showing when it was followed', () => {
    roveDown();
    const roved = shownEntryId();
    const target = firstLinkTargetIn(entryPage());
    follow(target, entryPage());
    expect(shownEntryId()).toBe(target);

    goBack();
    expect(shownEntryId()).toBe(roved);
  });
});
