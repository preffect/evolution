// The panel's keys on the real panel (docs/ui/encyclopedia.md §11.5), driven on the elements a reader's focus would
// actually be on. The rules themselves are `format/panel-keys.spec.ts`'s, pure; what these pin is the wiring — that
// the panel reads the two DOM facts correctly, suppresses the browser default, and puts focus where the answer says.
//
// It is its own file rather than a `describe` inside `encyclopedia.component.spec.ts` for a mechanical reason: every
// case here renders the whole panel (the rail, the list and a landing of 28 code-drawn glyph tiles) two or three
// times, and under coverage that is seconds apiece. Together with the panel spec's own cases one task ran long
// enough to block its vitest worker past the `onTaskUpdate` RPC timeout, which fails the run with every test green.
// Two files run in two workers, and each case stays well inside it.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectTestId } from '../../../testing/test-id-query';
import { EncyclopediaComponent } from './encyclopedia.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { entriesIn } from './registry';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaRowTestId } from './test-ids';

describe('the encyclopedia panel’s keys (docs/ui/encyclopedia.md §11.5)', () => {
  let fixture: ComponentFixture<EncyclopediaComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function searchField(): HTMLInputElement {
    return expectTestId(root(), ENCYCLOPEDIA_TEST_ID.search) as HTMLInputElement;
  }

  function tabStopIn(testId: string): HTMLElement {
    const stop = expectTestId(root(), testId).querySelector<HTMLElement>('[tabindex="0"]');
    expect(stop).not.toBeNull();
    return stop!;
  }

  /**
   * A row pressed as a browser presses one — `pointerdown`, `pointerup`, `click`, in that order. The `pointerdown`
   * is load-bearing rather than decorative: it is what tells the list that the kit's report beside the press is that
   * press's and not a rove, and a helper that omits it would quietly turn every push here into a replace
   * (`encyclopedia-activation-press.directive.ts`).
   */
  function openFirstEntry(): void {
    const first = entriesIn(state.location().category)[0]!.entries[0]!;
    const element = expectTestId(root(), encyclopediaRowTestId(first.entryId));
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    element.dispatchEvent(new Event('pointerup', { bubbles: true }));
    element.click();
    fixture.detectChanges();
  }

  /** Types into the real field, so the query the panel reads is the one the field produced. */
  function type(query: string): void {
    const field = searchField();
    field.value = query;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  /** Returns the event, so a case can ask whether the panel claimed the press. */
  function pressOn(element: Element, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaComponent);
    fixture.detectChanges();
  });

  it('focuses the search field on `/` from wherever the reader is, and never types the character', () => {
    const event = pressOn(tabStopIn(ENCYCLOPEDIA_TEST_ID.rail), { key: '/', code: 'Slash' });
    expect(document.activeElement).toBe(searchField());
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves `/` to the search field once the reader is typing in it', () => {
    searchField().focus();
    const event = pressOn(searchField(), { key: '/', code: 'Slash' });
    expect(event.defaultPrevented).toBe(false);
  });

  // Back, one chord per case: two in one `it` renders the panel twice over and was the longest task in the tier.

  it.each([
    ['Alt+←', { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true }],
    ['Backspace', { key: 'Backspace', code: 'Backspace' }],
  ])('goes back on %s', (_name, init) => {
    const landing = state.location();
    openFirstEntry();
    pressOn(tabStopIn(ENCYCLOPEDIA_TEST_ID.list), init);
    expect(state.location()).toEqual(landing);
  });

  it('keeps Backspace as the delete key while the search field holds focus', () => {
    const landing = state.location();
    openFirstEntry();
    searchField().focus();
    const event = pressOn(searchField(), { key: 'Backspace', code: 'Backspace' });
    expect(event.defaultPrevented).toBe(false);
    expect(state.location()).not.toEqual(landing);
  });

  /**
   * §11.5's "Enter opens the first result". The core guarantees the first result is also the row the list draws
   * first, so this asserts the entry the panel opened **is** `results()[0]` rather than naming an entry.
   */
  it('opens the first result on Enter in the search field, and pushes, so Back returns to the list', () => {
    const landing = state.location();
    type('mito');
    expect(state.results().length).toBeGreaterThan(0);

    searchField().focus();
    pressOn(searchField(), { key: 'Enter', code: 'Enter' });
    expect(state.location().entryId).toBe(state.results()[0]!.entryId);

    state.goBack();
    expect(state.location()).toEqual(landing);
  });

  it('opens nothing on Enter with no query, and nothing with a query that matched nothing', () => {
    const landing = state.location();
    searchField().focus();
    pressOn(searchField(), { key: 'Enter', code: 'Enter' });
    expect(state.location()).toEqual(landing);

    type('qqzz');
    pressOn(searchField(), { key: 'Enter', code: 'Enter' });
    expect(state.location()).toEqual(landing);
  });

  it('crosses from the rail to the list on → and back on ←', () => {
    pressOn(tabStopIn(ENCYCLOPEDIA_TEST_ID.rail), { key: 'ArrowRight', code: 'ArrowRight' });
    expect(document.activeElement).toBe(tabStopIn(ENCYCLOPEDIA_TEST_ID.list));

    pressOn(tabStopIn(ENCYCLOPEDIA_TEST_ID.list), { key: 'ArrowLeft', code: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabStopIn(ENCYCLOPEDIA_TEST_ID.rail));
  });

  /** Escape has one owner per press (input-and-onboarding.md §4), and the panel is never it. */
  it('claims no Escape of its own, so its host is the one that closes', () => {
    const event = pressOn(tabStopIn(ENCYCLOPEDIA_TEST_ID.list), { key: 'Escape', code: 'Escape' });
    expect(event.defaultPrevented).toBe(false);
  });
});
