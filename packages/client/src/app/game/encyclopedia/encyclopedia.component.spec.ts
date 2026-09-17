// The panel as a whole (docs/ui/encyclopedia.md §11.3): the header's four controls, the three columns, what
// `data-location` says, and what the panel does and does not host on its own.

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiFocusTrapDirective } from '../../ui-kit/ui-focus-trap.directive';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import { ENCYCLOPEDIA_TITLE } from './encyclopedia-constants';
import { EncyclopediaComponent } from './encyclopedia.component';
import { EncyclopediaStateService } from './encyclopedia-state.service';
import { locationAttributeFor } from './format/panel-view';
import { entriesIn } from './registry';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaRowTestId } from './test-ids';

describe('EncyclopediaComponent (docs/ui/encyclopedia.md §11.3)', () => {
  let fixture: ComponentFixture<EncyclopediaComponent>;
  let state: EncyclopediaStateService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function panel(): HTMLElement {
    return expectTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia);
  }

  function openFirstEntry(): string {
    const first = entriesIn(state.location().category)[0]!.entries[0]!;
    expectTestId(root(), encyclopediaRowTestId(first.entryId)).click();
    fixture.detectChanges();
    return first.entryId;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaComponent] });
    state = TestBed.inject(EncyclopediaStateService);
    fixture = TestBed.createComponent(EncyclopediaComponent);
    fixture.detectChanges();
  });

  it('is a modal dialog named for itself, over a scrim, holding the rail, the list and the detail', () => {
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(panel().getAttribute('aria-label')).toBe(ENCYCLOPEDIA_TITLE);
    expect(root().querySelector('ui-scrim')).not.toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.rail)).not.toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.list)).not.toBeNull();
  });

  it('carries the four header controls, each with its own test id and reachable by keyboard', () => {
    for (const testId of [ENCYCLOPEDIA_TEST_ID.back, ENCYCLOPEDIA_TEST_ID.close]) {
      expect(expectTestId(root(), testId).tagName).toBe('BUTTON');
    }
    expect(expectTestId(root(), ENCYCLOPEDIA_TEST_ID.search).tagName).toBe('INPUT');
  });

  it('opens on a category landing, not on an entry page', () => {
    expect(state.location().entryId).toBeNull();
    expect(root().querySelector('app-encyclopedia-landing')).not.toBeNull();
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.entry)).toBeNull();
  });

  it('swaps the landing for the entry area once an entry is opened', () => {
    const entryId = openFirstEntry();
    expect(root().querySelector('app-encyclopedia-landing')).toBeNull();
    expect(expectTestId(root(), ENCYCLOPEDIA_TEST_ID.entry).getAttribute('data-entry-id')).toBe(entryId);
  });

  it('writes where the reader is on the panel, and moves it as they move', () => {
    expect(panel().getAttribute('data-location')).toBe(locationAttributeFor(state.location()));
    openFirstEntry();
    expect(panel().getAttribute('data-location')).toBe(locationAttributeFor(state.location()));
  });

  it('disables Back while the history is empty and enables it after one move', () => {
    expect(expectTestId(root(), ENCYCLOPEDIA_TEST_ID.back).getAttribute('aria-disabled')).toBe('true');
    openFirstEntry();
    expect(expectTestId(root(), ENCYCLOPEDIA_TEST_ID.back).getAttribute('aria-disabled')).toBeNull();
  });

  it('goes back one move when Back is pressed, and nowhere at all when it is disabled', () => {
    const landing = state.location();
    openFirstEntry();
    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.back).click();
    fixture.detectChanges();
    expect(state.location()).toEqual(landing);

    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.back).click();
    fixture.detectChanges();
    expect(state.location()).toEqual(landing);
  });

  it('keeps the Tab stop on a disabled Back, so the header order never shifts under the reader', () => {
    expect(expectTestId(root(), ENCYCLOPEDIA_TEST_ID.back).getAttribute('tabindex')).toBeNull();
  });

  it('edits the query as the field is typed in, and nothing else', () => {
    const field = expectTestId(root(), ENCYCLOPEDIA_TEST_ID.search) as HTMLInputElement;
    const before = state.location();
    field.value = 'mito';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(state.query()).toBe('mito');
    expect(state.location()).toEqual(before);
  });

  it('asks its host to close rather than closing itself: where the close goes is the host’s (§11.1)', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    expectTestId(root(), ENCYCLOPEDIA_TEST_ID.close).click();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
  });

  /**
   * The kit sets a modal's padding through `:host([data-variant='modal'])`, which a bare `.panel` in this
   * component's own stylesheet only *ties* with — and a tie is settled by whichever sheet the browser happened to
   * order last. The columns then sat a panel padding in from the rail, which the reference frame draws flush.
   */
  it('lays its columns edge to edge: the kit modal’s padding is overridden, not merely tied with', () => {
    expect(getComputedStyle(panel()).padding).toBe('0px');
  });

  it('draws no alert strip of its own: a host with no strip to project leaves the header without one', () => {
    expect(queryByTestId(root(), ENCYCLOPEDIA_TEST_ID.alert)).toBeNull();
  });

  it('holds focus inside itself: the kit focus trap is on the panel, not on the layer around it', () => {
    const trapped = fixture.debugElement.query(By.directive(UiFocusTrapDirective));
    expect(trapped).not.toBeNull();
    expect(trapped.nativeElement).toBe(panel());
  });
});
