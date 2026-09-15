import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_BUTTON_VARIANT } from '../ui-button.component';
import { isUiKitStatesRouteEnabled } from './kit-states-route';
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
