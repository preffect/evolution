// The dev-only collections sheet of the UI kit page (`/?kit&sheet=collections`, docs/ui/components-and-constants.md
// §10.2): the rail item and list row in every state, a horizontal rail, the chips, link chips, medallions and alert
// pills, and a live browser (a search field over a rail and a sectioned list, each in a scroll area) that filters as
// it is typed into. As on the states sheet, nothing fakes a state with a class: selection and disabled are real
// inputs, and the evidence script forces hover, pressed and focus through the browser.

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  CELL_WALL,
  CHLORO_BASE,
  CILIA,
  CYTOSKELETON,
  ENVELOPE,
  FLAGELLUM,
  FOOD_MOTE,
  LIPID_BASE,
  MITO_BASE,
  NUCLEOID_GLOW,
  PROTO_FILM,
  RIBOSOME,
  TEXT_LABEL,
  TOXIN_GLOW,
  VAC_BASE,
} from '../../game/render/constants/colours';
import { UI_ALERT_TONE, UiAlertPillComponent } from '../ui-alert-pill.component';
import { UI_CHIP_TONE, UiChipComponent, UiLinkChipComponent } from '../ui-chip.component';
import { UiListRowComponent } from '../ui-list-row.component';
import { UiListSectionComponent } from '../ui-list-section.component';
import { UiListComponent } from '../ui-list.component';
import { UiMedallionComponent } from '../ui-medallion.component';
import { UiRailItemComponent } from '../ui-rail-item.component';
import { UiRailComponent } from '../ui-rail.component';
import { UiScrollAreaComponent } from '../ui-scroll-area.component';
import { UiSearchFieldComponent } from '../ui-search-field.component';
import { UiSurfaceDirective } from '../ui-surface.directive';
import { KIT_COLLECTIONS_TEMPLATE } from './kit-collections.template';

export const KIT_ROW_STATES = ['rest', 'hover', 'pressed', 'selected', 'selected-focus', 'disabled'] as const;
export type KitRowState = (typeof KIT_ROW_STATES)[number];

export const KIT_LINK_CHIP_STATES = ['rest', 'hover', 'pressed', 'focus'] as const;

export const UI_KIT_COLLECTIONS_TEST_ID = {
  page: 'ui-kit-collections',
  search: 'ui-kit-search',
  rail: 'ui-kit-rail',
  list: 'ui-kit-list',
  listScroll: 'ui-kit-list-scroll',
  noMatch: 'ui-kit-no-match',
} as const;

export function kitRowTestId(part: 'rail-item' | 'list-row', state: KitRowState): string {
  return `ui-kit-${part}-${state}`;
}

export function kitSampleTestId(part: string, id: string): string {
  return `ui-kit-${part}-${id}`;
}

const ROW_STATE_LABEL: Readonly<Record<KitRowState, string>> = {
  rest: 'Rest',
  hover: 'Hover',
  pressed: 'Pressed',
  selected: 'Selected',
  'selected-focus': 'Selected + focus',
  disabled: 'Disabled',
};

/** The harness's own layout, px at scale 1 (scaled in its stylesheet like every kit length). */
const STATE_CELL_WIDTH_PX = 150;
const BROWSER_WIDTH_PX = 500;
const BROWSER_RAIL_WIDTH_PX = 184;

export interface SampleEntry {
  readonly id: string;
  readonly title: string;
  readonly colour: string;
  readonly isOwned?: boolean;
}

interface SampleCategory {
  readonly id: string;
  readonly label: string;
  readonly groups: readonly { readonly heading: string; readonly entries: readonly SampleEntry[] }[];
}

export interface SampleSection {
  readonly sectionId: string;
  readonly heading: string;
  readonly entries: readonly SampleEntry[];
}

const SAMPLE_CATEGORIES: readonly SampleCategory[] = [
  {
    id: 'basics',
    label: 'Basics',
    groups: [
      { heading: 'Rules', entries: [entry('mass', 'Mass and size', FOOD_MOTE), entry('engulf', 'Engulf', PROTO_FILM)] },
      { heading: 'Reading the screen', entries: [entry('leaderboard', 'Leaderboard', TEXT_LABEL)] },
    ],
  },
  {
    id: 'cells',
    label: 'Cells & food',
    groups: [
      {
        heading: 'Food',
        entries: [entry('algae', 'Algae mote', FOOD_MOTE), entry('detritus', 'Detritus', LIPID_BASE)],
      },
    ],
  },
  {
    id: 'evolution',
    label: 'Evolution',
    groups: [
      {
        heading: 'Genome',
        entries: [entry('nucleoid', 'Nucleoid Coil', NUCLEOID_GLOW), entry('envelope', 'Nuclear Envelope', ENVELOPE)],
      },
      {
        heading: 'Locomotion',
        entries: [
          entry('flagellum', 'Simple Flagellum', FLAGELLUM),
          entry('cytoskeleton', 'Cytoskeleton Lattice', CYTOSKELETON),
          entry('cilia', 'Cilia Fringe', CILIA),
        ],
      },
      { heading: 'Membrane', entries: [entry('cell-wall', 'Cell Wall', CELL_WALL)] },
      { heading: 'Offense', entries: [entry('toxin-vacuole', 'Toxin Vacuole', TOXIN_GLOW)] },
      {
        heading: 'Metabolism',
        entries: [
          entry('ribosomes', 'Ribosome Studs', RIBOSOME),
          { ...entry('mitochondrion', 'Mitochondrion', MITO_BASE), isOwned: true },
          entry('chloroplast', 'Chloroplast', CHLORO_BASE),
          entry('food-vacuole', 'Food Vacuole', VAC_BASE),
        ],
      },
    ],
  },
];

function entry(id: string, title: string, colour: string): SampleEntry {
  return { id, title, colour };
}

function normalised(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * The browser's list: the category's groups, or while there is a query every entry whose title holds it (case- and
 * accent-insensitive) under its category's label. The kit's search field only edits the query; this is the sample's.
 */
export function sampleSectionsFor(categoryId: string, query: string): SampleSection[] {
  const needle = normalised(query.trim());
  if (needle === '') {
    const groups = SAMPLE_CATEGORIES.find((category) => category.id === categoryId)?.groups ?? [];
    return groups.map((group) => ({ sectionId: `${categoryId}:${group.heading}`, ...group }));
  }
  return SAMPLE_CATEGORIES.map((category) => ({
    sectionId: category.id,
    heading: category.label,
    entries: category.groups
      .flatMap((group) => group.entries)
      .filter((item) => normalised(item.title).includes(needle)),
  })).filter((section) => section.entries.length > 0);
}

function entryCount(category: SampleCategory): number {
  return category.groups.reduce((count, group) => count + group.entries.length, 0);
}

@Component({
  selector: 'ui-kit-collections',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiAlertPillComponent,
    UiChipComponent,
    UiLinkChipComponent,
    UiListComponent,
    UiListRowComponent,
    UiListSectionComponent,
    UiMedallionComponent,
    UiRailComponent,
    UiRailItemComponent,
    UiScrollAreaComponent,
    UiSearchFieldComponent,
    UiSurfaceDirective,
  ],
  template: KIT_COLLECTIONS_TEMPLATE,
  host: { '[style]': 'layoutVariables' },
  styleUrls: ['./kit-states.component.css', './kit-collections.component.css'],
})
export class UiKitCollectionsComponent {
  protected readonly testId = UI_KIT_COLLECTIONS_TEST_ID;
  protected readonly sampleTestId = kitSampleTestId;
  protected readonly layoutVariables = {
    '--kit-state-cell': `${STATE_CELL_WIDTH_PX}px`,
    '--kit-browser-width': `${BROWSER_WIDTH_PX}px`,
    '--kit-browser-rail-width': `${BROWSER_RAIL_WIDTH_PX}px`,
  };

  protected readonly rowStates = KIT_ROW_STATES.map((state) => ({
    state,
    label: ROW_STATE_LABEL[state],
    isSelected: state === 'selected' || state === 'selected-focus',
    isDisabled: state === 'disabled',
    railTestId: kitRowTestId('rail-item', state),
    listTestId: kitRowTestId('list-row', state),
  }));
  protected readonly categories = SAMPLE_CATEGORIES.map((category) => ({ ...category, count: entryCount(category) }));
  protected readonly stateSample = { category: this.categories[0], cellWall: CELL_WALL };
  protected readonly tabs = [
    { id: 'effects', title: 'Effects' },
    { id: 'ladder', title: 'Ladder' },
    { id: 'notes', title: 'Notes' },
  ];
  protected readonly chips = [
    { tone: UI_CHIP_TONE.muted, label: 'Common', dotColour: null },
    { tone: UI_CHIP_TONE.strong, label: 'Uncommon', dotColour: null },
    { tone: UI_CHIP_TONE.dna, label: 'Rare', dotColour: null },
    { tone: UI_CHIP_TONE.neutral, label: 'Metabolic', dotColour: MITO_BASE },
    { tone: UI_CHIP_TONE.gold, label: 'Owned · I', dotColour: null },
    { tone: UI_CHIP_TONE.danger, label: 'Toxic', dotColour: null },
    { tone: UI_CHIP_TONE.accent, label: 'Selected', dotColour: null },
  ];
  protected readonly linkChipTestIds = KIT_LINK_CHIP_STATES.map((state) => kitSampleTestId('link-chip', state));
  protected readonly alerts = [
    { id: 'threat', tone: UI_ALERT_TONE.danger, label: 'Amoeboid can engulf you', figure: null },
    { id: 'engulfed', tone: UI_ALERT_TONE.danger, label: 'Sprint to escape', figure: null },
    { id: 'offer', tone: UI_ALERT_TONE.gold, label: 'Level 5 · choose a trait ·', figure: '6.5 s' },
  ];

  protected readonly query = signal('');
  protected readonly category = signal('evolution');
  protected readonly selectedEntry = signal<string | null>('mitochondrion');
  /** While there is a query the rail shows no selection: the list holds results from every category. */
  protected readonly railSelection = computed(() => (this.query().trim() === '' ? this.category() : null));
  protected readonly sections = computed(() => sampleSectionsFor(this.category(), this.query()));

  protected showCategory(categoryId: string | null): void {
    if (categoryId === null) return;
    this.query.set('');
    this.category.set(categoryId);
  }
}
