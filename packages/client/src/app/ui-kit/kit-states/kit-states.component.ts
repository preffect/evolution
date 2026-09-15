// The dev-only UI kit states page (docs/ui/components-and-constants.md §10.2): `/?kit` in a dev build draws every
// button variant in every state, the sizes and key hints, a side panel and a modal behind a button, on one
// `[uiSurface]`, so a review compares it against `qa/decisions/encyclopedia/kit-states-1280x800.png`. Nothing
// here fakes a state with a class: the evidence script forces hover, pressed and focus through the browser
// (CDP `CSS.forcePseudoState`), so what is drawn is the real stylesheet.

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DANGER, FOOD_MOTE, LEVEL_GOLD, TEXT_MUTED, ZONE_VENT } from '../../game/render/constants/colours';
import { UI_BUTTON_VARIANT, UiButtonComponent, type UiButtonVariant } from '../ui-button.component';
import { UiAutofocusDirective, UiFocusTrapDirective } from '../ui-focus-trap.directive';
import { UiKeyHintComponent } from '../ui-key-hint.component';
import { UiPanelSectionComponent } from '../ui-panel-section.component';
import { UiPanelComponent } from '../ui-panel.component';
import { UiScrimComponent } from '../ui-scrim.component';
import { UiSurfaceDirective } from '../ui-surface.directive';

export const KIT_STATES = ['rest', 'hover', 'pressed', 'focus', 'disabled'] as const;
export type KitState = (typeof KIT_STATES)[number];

export const UI_KIT_STATES_TEST_ID = {
  page: 'ui-kit-states',
  sidePanel: 'ui-kit-side-panel',
  openModal: 'ui-kit-open-modal',
  scrim: 'ui-kit-scrim',
  modal: 'ui-kit-modal',
  modalStay: 'ui-kit-modal-stay',
  modalExit: 'ui-kit-modal-exit',
} as const;

/** The sample modal's scrim: a page of its own, so it borrows no overlay's alpha. */
const SAMPLE_SCRIM_ALPHA = 0.6;

export function kitButtonTestId(variant: UiButtonVariant, state: KitState): string {
  return `ui-kit-button-${variant}-${state}`;
}

const BUTTON_LABEL: Readonly<Record<UiButtonVariant, string>> = {
  [UI_BUTTON_VARIANT.primary]: 'Return',
  [UI_BUTTON_VARIANT.secondary]: 'Browse',
  [UI_BUTTON_VARIANT.danger]: 'Exit game',
  [UI_BUTTON_VARIANT.quiet]: 'Skip',
  [UI_BUTTON_VARIANT.icon]: 'Close',
};

const BUTTON_ROWS = Object.values(UI_BUTTON_VARIANT).map((variant) => ({
  variant,
  label: BUTTON_LABEL[variant],
  isIcon: variant === UI_BUTTON_VARIANT.icon,
  cells: KIT_STATES.map((state) => ({ testId: kitButtonTestId(variant, state), isDisabled: state === 'disabled' })),
}));

const SIDE_SECTIONS = [
  {
    heading: 'Mass',
    facts: [
      { marker: FOOD_MOTE, name: 'Food', value: '+1.1/s' },
      { marker: TEXT_MUTED, name: 'Decay', value: '−0.5/s' },
      { marker: DANGER, name: 'Toxin', value: '−9.4/s' },
    ],
  },
  {
    heading: 'Here',
    facts: [
      { marker: ZONE_VENT, name: 'Warm vent', value: 'decay ×1.5' },
      { marker: LEVEL_GOLD, name: 'Bloom', value: '1:48' },
    ],
  },
];

@Component({
  selector: 'ui-kit-states',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiAutofocusDirective,
    UiButtonComponent,
    UiFocusTrapDirective,
    UiKeyHintComponent,
    UiPanelComponent,
    UiPanelSectionComponent,
    UiScrimComponent,
    UiSurfaceDirective,
  ],
  templateUrl: './kit-states.component.html',
  styleUrl: './kit-states.component.css',
})
export class UiKitStatesComponent {
  protected readonly testId = UI_KIT_STATES_TEST_ID;
  protected readonly states = KIT_STATES;
  protected readonly rows = BUTTON_ROWS;
  protected readonly sections = SIDE_SECTIONS;
  protected readonly scrimAlpha = SAMPLE_SCRIM_ALPHA;
  protected readonly isModalOpen = signal(false);

  protected openModal(): void {
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }
}
