import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_BUTTON_VARIANT } from '../ui-button.component';
import {
  KIT_ROW_STATES,
  UI_KIT_COLLECTIONS_TEST_ID,
  kitRowTestId,
  kitSampleTestId,
  sampleSectionsFor,
} from './kit-collections.component';
import { KIT_SHEET, UI_KIT_SHEET, isUiKitStatesRouteEnabled, kitSheetFor } from './kit-states-route';
import { KIT_STATES, UI_KIT_STATES_TEST_ID, UiKitStatesComponent, kitButtonTestId } from './kit-states.component';

describe('isUiKitStatesRouteEnabled', () => {
  it('opens only on ?kit in a development build', () => {
    expect(isUiKitStatesRouteEnabled(true, '?kit')).toBe(true);
    expect(isUiKitStatesRouteEnabled(true, '?bench=1&kit')).toBe(true);
    expect(isUiKitStatesRouteEnabled(true, '?bench=1')).toBe(false);
    expect(isUiKitStatesRouteEnabled(true, null)).toBe(false);
    expect(isUiKitStatesRouteEnabled(false, '?kit')).toBe(false);
  });
});

describe('UiKitStatesComponent', () => {
  let fixture: ComponentFixture<UiKitStatesComponent>;

  function byTestId(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [UiKitStatesComponent] });
    fixture = TestBed.createComponent(UiKitStatesComponent);
    fixture.detectChanges();
  });

  it('draws every variant in every state, the disabled column disabled', () => {
    for (const variant of Object.values(UI_BUTTON_VARIANT)) {
      for (const state of KIT_STATES) {
        const button = byTestId(kitButtonTestId(variant, state));
        expect(button, `${variant} ${state}`).not.toBeNull();
        expect(button?.getAttribute('aria-disabled')).toBe(state === 'disabled' ? 'true' : null);
      }
    }
    expect(byTestId(UI_KIT_STATES_TEST_ID.sidePanel)?.getAttribute('role')).toBe('region');
  });

  it('opens the sample modal with focus trapped on Stay, and Escape hands focus back to the opener', () => {
    const opener = byTestId(UI_KIT_STATES_TEST_ID.openModal)!;
    opener.focus();
    opener.click();
    fixture.detectChanges();
    expect(byTestId(UI_KIT_STATES_TEST_ID.scrim)).not.toBeNull();
    expect(document.activeElement).toBe(byTestId(UI_KIT_STATES_TEST_ID.modalStay));

    byTestId(UI_KIT_STATES_TEST_ID.modalStay)!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(byTestId(UI_KIT_STATES_TEST_ID.modal)).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('kitSheetFor', () => {
  it('opens the collections sheet on ?kit&sheet=collections and the states sheet otherwise', () => {
    expect(kitSheetFor('?kit&sheet=collections')).toBe(KIT_SHEET.collections);
    expect(kitSheetFor('?kit')).toBe(KIT_SHEET.states);
    expect(kitSheetFor('?kit&sheet=bogus')).toBe(KIT_SHEET.states);
    expect(kitSheetFor(null)).toBe(KIT_SHEET.states);
  });
});

describe('sampleSectionsFor', () => {
  it('lists the category’s groups while there is no query', () => {
    expect(sampleSectionsFor('evolution', '  ').map((section) => section.heading)).toEqual([
      'Genome',
      'Locomotion',
      'Membrane',
      'Offense',
      'Metabolism',
    ]);
  });

  it('with a query lists every matching title under its category, case- and accent-insensitive', () => {
    const sections = sampleSectionsFor('basics', 'RIBOSÓME');
    expect(sections.map((section) => section.heading)).toEqual(['Evolution']);
    expect(sections[0]?.entries.map((entry) => entry.title)).toEqual(['Ribosome Studs']);
    expect(sampleSectionsFor('basics', 'o').map((section) => section.heading)).toEqual([
      'Basics',
      'Cells & food',
      'Evolution',
    ]);
    expect(sampleSectionsFor('basics', 'xyz')).toEqual([]);
  });
});

describe('UiKitCollectionsComponent, through the ?kit&sheet=collections page', () => {
  let fixture: ComponentFixture<UiKitStatesComponent>;

  function byTestId(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  function search(query: string): void {
    const input = byTestId(UI_KIT_COLLECTIONS_TEST_ID.search) as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UiKitStatesComponent],
      providers: [{ provide: UI_KIT_SHEET, useValue: KIT_SHEET.collections }],
    });
    fixture = TestBed.createComponent(UiKitStatesComponent);
    fixture.detectChanges();
  });

  it('draws the collections sheet in place of the states sheet', () => {
    expect(byTestId(UI_KIT_COLLECTIONS_TEST_ID.page)).not.toBeNull();
    expect(byTestId(UI_KIT_STATES_TEST_ID.page)).toBeNull();
  });

  it('draws the rail item and the list row in every state, selected and disabled for real', () => {
    for (const part of ['rail-item', 'list-row'] as const) {
      for (const state of KIT_ROW_STATES) {
        const item = byTestId(kitRowTestId(part, state));
        expect(item, `${part} ${state}`).not.toBeNull();
        const isSelected = state === 'selected' || state === 'selected-focus';
        expect(item?.getAttribute('aria-selected')).toBe(String(isSelected));
        expect(item?.getAttribute('aria-disabled')).toBe(state === 'disabled' ? 'true' : null);
      }
    }
  });

  it('filters the live list as the search is typed into, and Escape brings the category back', () => {
    expect(byTestId(kitSampleTestId('category', 'evolution'))?.getAttribute('aria-selected')).toBe('true');
    search('chloro');
    expect(byTestId(kitSampleTestId('entry', 'chloroplast'))).not.toBeNull();
    expect(byTestId(kitSampleTestId('entry', 'mitochondrion'))).toBeNull();
    expect(byTestId(kitSampleTestId('category', 'evolution'))?.getAttribute('aria-selected')).toBe('false');
    search('xyz');
    expect(byTestId(UI_KIT_COLLECTIONS_TEST_ID.noMatch)?.textContent).toContain('No match for "xyz"');
    byTestId(UI_KIT_COLLECTIONS_TEST_ID.search)!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(byTestId(UI_KIT_COLLECTIONS_TEST_ID.noMatch)).toBeNull();
    expect(byTestId(kitSampleTestId('entry', 'mitochondrion'))).not.toBeNull();
  });

  it('arrowing the live rail shows each category in turn', () => {
    const evolution = byTestId(kitSampleTestId('category', 'evolution'))!;
    evolution.focus();
    evolution.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(byTestId(kitSampleTestId('category', 'basics'))?.getAttribute('aria-selected')).toBe('true');
    expect(byTestId(kitSampleTestId('entry', 'leaderboard'))).not.toBeNull();
  });
});
