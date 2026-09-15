// The dev-only UI kit states page (docs/ui/components-and-constants.md §10.2): `/?kit` in a dev build draws every
// button variant in every state, the sizes and key hints, a side panel and a modal behind a button, on one
// `[uiSurface]`, so a review compares it against `qa/decisions/encyclopedia/kit-states-1280x800.png`. Nothing
// here fakes a state with a class: the evidence script forces hover, pressed and focus through the browser
// (CDP `CSS.forcePseudoState`), so what is drawn is the real stylesheet.

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  CHLORO_BASE,
  CILIA,
  DANGER,
  FOOD_MOTE,
  LEVEL_GOLD,
  MITO_BASE,
  TEXT_MUTED,
  TOXIN_GLOW,
  ZONE_VENT,
} from '../../game/render/constants/colours';
import { UI_BUTTON_VARIANT, UiButtonComponent, type UiButtonVariant } from '../ui-button.component';
import {
  UI_FACT_MARKER_SHAPE,
  UiFactsTableComponent,
  type UiFactMarkerShape,
  type UiFactRow,
} from '../ui-facts-table.component';
import { UiAutofocusDirective, UiFocusTrapDirective } from '../ui-focus-trap.directive';
import { UiKeyHintComponent } from '../ui-key-hint.component';
import { UiPanelSectionComponent } from '../ui-panel-section.component';
import { UiPanelComponent } from '../ui-panel.component';
import { UiScrimComponent } from '../ui-scrim.component';
import { UiSurfaceDirective } from '../ui-surface.directive';
import { UiKitCollectionsComponent } from './kit-collections.component';
import { KIT_SHEET, UI_KIT_SHEET } from './kit-states-route';

export const KIT_STATES = ['rest', 'hover', 'pressed', 'focus', 'disabled'] as const;
export type KitState = (typeof KIT_STATES)[number];

export const UI_KIT_STATES_TEST_ID = {
  page: 'ui-kit-states',
  sidePanel: 'ui-kit-side-panel',
  tierTable: 'ui-kit-tier-table',
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

function fact(name: string, value: string, shape: UiFactMarkerShape, colour: string): UiFactRow {
  return { rowId: name, name, values: [value], marker: { shape, colour } };
}

const { dot, ring } = UI_FACT_MARKER_SHAPE;

/** Enough sections that the side panel's body overflows, so its scroll area shows the edge fade. */
const SIDE_SECTIONS = [
  {
    heading: 'Mass',
    rows: [
      fact('Food', '+1.1/s', dot, FOOD_MOTE),
      fact('Decay', '−0.5/s', dot, TEXT_MUTED),
      fact('Toxin', '−9.4/s', dot, DANGER),
    ],
  },
  {
    heading: 'Here',
    rows: [fact('Warm vent', 'decay ×1.5', dot, ZONE_VENT), fact('Bloom', '1:48', dot, LEVEL_GOLD)],
  },
  {
    heading: 'Traits',
    rows: [
      fact('Mitochondrion I', '−15 %', ring, MITO_BASE),
      fact('Chloroplast I', '+0.3/s', ring, CHLORO_BASE),
      fact('Cilia Fringe II', '+8 %', ring, CILIA),
      fact('Toxin Vacuole I', '4/s', ring, TOXIN_GLOW),
    ],
  },
];

/** A tier table under its caption, the owned tier's column highlighted. */
const TIER_TABLE = {
  caption: 'You own I',
  columns: ['I', 'II', 'III'],
  ownedColumn: 0,
  rows: [
    { rowId: 'decay', name: 'Mass decay', values: ['−15 %', '−30 %', '−45 %'] },
    { rowId: 'sprint', name: 'Sprint speed', values: ['+10 %', '+20 %', '+30 %'] },
  ],
};

/** The side panel sample's height, px at scale 1: short of its content, so the fade shows. */
const SIDE_PANEL_SAMPLE_HEIGHT_PX = 272;

@Component({
  selector: 'ui-kit-states',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiAutofocusDirective,
    UiButtonComponent,
    UiFactsTableComponent,
    UiFocusTrapDirective,
    UiKitCollectionsComponent,
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
  protected readonly tierTable = TIER_TABLE;
  protected readonly sampleVariables = { '--kit-side-panel-height': `${SIDE_PANEL_SAMPLE_HEIGHT_PX}px` };
  protected readonly isCollectionsSheet = inject(UI_KIT_SHEET) === KIT_SHEET.collections;
  protected readonly scrimAlpha = SAMPLE_SCRIM_ALPHA;
  protected readonly isModalOpen = signal(false);

  protected openModal(): void {
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }
}
