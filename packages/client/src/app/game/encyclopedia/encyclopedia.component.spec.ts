// The panel as a whole (docs/ui/encyclopedia.md §11.3): the header's four controls, the three columns, what
// `data-location` says, and what the panel does and does not host on its own.

import { styleRuleValue } from '../../../testing/style-rules';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiFocusTrapDirective } from '../../ui-kit/ui-focus-trap.directive';
import { expectTestId, queryByTestId } from '../../../testing/test-id-query';
import {
  ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA,
  ENCYCLOPEDIA_SCRIM_ALPHA,
  ENCYCLOPEDIA_SEARCH_PLACEHOLDER,
  ENCYCLOPEDIA_TITLE,
} from './encyclopedia-constants';
import { recordingPreviewProvider } from '../../../testing/fake-preview-handle';
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

  /**
   * A row pressed as a browser presses one — `pointerdown`, `pointerup`, `click`, in that order. Since ticket #622 the
   * kit reports the activation itself and nothing reads the first two; they stay so the press is driven as a browser
   * drives it (docs/ui/encyclopedia.md §11.5).
   */
  function openFirstEntry(): string {
    const first = entriesIn(state.location().category)[0]!.entries[0]!;
    const element = expectTestId(root(), encyclopediaRowTestId(first.entryId));
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    element.dispatchEvent(new Event('pointerup', { bubbles: true }));
    element.click();
    fixture.detectChanges();
    return first.entryId;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaComponent], providers: [recordingPreviewProvider()] });
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

  /** Nothing read the placeholder at all before #460's review, so the field could have shown any word. */
  it('shows the search field\u2019s placeholder, which is also what names the field', () => {
    const field = expectTestId(root(), ENCYCLOPEDIA_TEST_ID.search);
    expect(field.getAttribute('placeholder')).toBe(ENCYCLOPEDIA_SEARCH_PLACEHOLDER);
    expect(field.getAttribute('placeholder')).toBe('Search');
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
   * The columns run edge to edge (§11.3) on the kit's bleed body (#461): the kit drops the modal's padding and its
   * scroll area, so this component neither out-specifies the kit's padding nor lays its columns against a kit box.
   */
  it('lays its columns edge to edge on the kit’s bleed body, positioned against nothing of the kit’s', () => {
    expect(panel().getAttribute('data-body')).toBe('bleed');
    // The panel's padding is its `--panel-inset`, which a bleed body zeroes; jsdom does not substitute a variable.
    const panelStyle = getComputedStyle(panel());
    expect(panelStyle.getPropertyValue('--panel-inset').trim()).toBe('0px');
    expect(panelStyle.padding).toBe('var(--panel-inset)');
    const columns = root().querySelector<HTMLElement>('.columns');
    expect(columns?.closest('ui-scroll-area')).toBeNull();
    expect(styleRuleValue(document, ['.columns'], 'position')).toBeNull();
  });

  /**
   * §11.7 gives the scrim two values, and which one applies is the host's answer, not the panel's: in a round the
   * dish keeps running faintly under it, and outside one there is nothing behind worth keeping half-legible.
   */
  it('keeps the dish faintly visible under it in a round', () => {
    const scrim = root().querySelector<HTMLElement>('ui-scrim');
    expect(scrim?.style.getPropertyValue('--ui-scrim-alpha')).toBe(String(ENCYCLOPEDIA_SCRIM_ALPHA));
  });

  it('covers completely when its host says no dish is behind it', () => {
    fixture.componentRef.setInput('isOverDish', false);
    fixture.detectChanges();
    const scrim = root().querySelector<HTMLElement>('ui-scrim');
    expect(scrim?.style.getPropertyValue('--ui-scrim-alpha')).toBe(String(ENCYCLOPEDIA_LOBBY_SCRIM_ALPHA));
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
