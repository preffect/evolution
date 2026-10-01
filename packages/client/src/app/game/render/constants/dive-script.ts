// The opening dive's words and where they sit (docs/rendering/opening-dive.md, ticket #797): the phase stops, the
// size ladder the readout reads, and the labels. Every entry is the mockup's (`PHASES`, `LADDER`, `GEO_LABELS`,
// `WORLD_LABELS`); a world label's place is the mockup's expression worked out in metres around the focus.

/** One phase's opening: the dive plays from orbit down to `zoom` and stops there. */
export interface DivePhaseStop {
  readonly phaseNumber: number;
  readonly name: string;
  readonly zoom: number;
  readonly colour: string;
  /** An idea for a later chapter, not in the phases plan yet (ticket #782): drawn dashed and marked "(idea)". */
  readonly isFuture: boolean;
}

export const DIVE_PHASE_STOPS: readonly DivePhaseStop[] = [
  { phaseNumber: 1, name: 'The dish', zoom: -4.3, colour: '#6fd6e6', isFuture: false },
  { phaseNumber: 2, name: 'The drop', zoom: -2.7, colour: '#8fd49a', isFuture: false },
  { phaseNumber: 3, name: 'Colonies', zoom: -2.0, colour: '#c9e07a', isFuture: false },
  { phaseNumber: 4, name: 'Tide pool', zoom: -0.6, colour: '#e8b04b', isFuture: true },
  { phaseNumber: 5, name: 'The shore', zoom: 1.1, colour: '#e98a6b', isFuture: true },
];

/** What fills the screen at one power of ten: the readout's third line. */
export interface DiveLadderRow {
  readonly powerOfTen: number;
  readonly whatYouSee: string;
}

export const DIVE_LADDER: readonly DiveLadderRow[] = [
  { powerOfTen: 7, whatYouSee: 'Earth, over Eurasia. The planet turns to bring North America’s Pacific coast round.' },
  { powerOfTen: 6, whatYouSee: 'The Pacific Northwest. Vancouver Island and the Salish Sea.' },
  { powerOfTen: 5, whatYouSee: 'Southern Vancouver Island and the Juan de Fuca Strait.' },
  { powerOfTen: 4, whatYouSee: 'Where Victoria will be. Forest runs down to a rocky coast; no town, no people.' },
  { powerOfTen: 3, whatYouSee: 'A rocky point. Kelp beds show as brown patches offshore.' },
  { powerOfTen: 2, whatYouSee: 'The shore at low tide: bare rock, tide pools, boulders.' },
  { powerOfTen: 1, whatYouSee: 'Boulders. One has a bull kelp washed over it.' },
  { powerOfTen: 0, whatYouSee: 'The boulder and the kelp: a gas-filled bulb and long strap blades.' },
  { powerOfTen: -1, whatYouSee: 'The blade’s surface, beaded with drops of spray.' },
  { powerOfTen: -2, whatYouSee: 'One drop of sea spray, 5 mm across, sitting on the blade.' },
  { powerOfTen: -3, whatYouSee: 'Inside the drop, near its edge. The blade is the floor.' },
  {
    powerOfTen: -4,
    whatYouSee: 'The slime on the kelp’s cells. A pocket of clear water 40 µm across: the dish.',
  },
  { powerOfTen: -5, whatYouSee: 'Inside the dish: bacteria and specks of food.' },
  { powerOfTen: -6, whatYouSee: 'One bacterium: you, at the start of the game.' },
];

/** The zoom range a label shows over (`labelAlpha`'s `[a, b]`): it fades in and out at both ends. */
export interface DiveLabelRange {
  readonly nearZoom: number;
  readonly farZoom: number;
}

// Labels are written in capitals here rather than by CSS: `text-transform: uppercase` turns µ into a capital mu
// that reads as M (40 µm as "40 MM"), so the units stay lower case.

/** A place name on the planet, at `[longitude, latitude]` degrees. */
export interface DiveGeoLabel {
  readonly text: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly range: DiveLabelRange;
}

/** A thing in the world, at `x` east and `y` south of the focus in metres. */
export interface DiveWorldLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly range: DiveLabelRange;
}

export const DIVE_GEO_LABELS: readonly DiveGeoLabel[] = [
  { text: 'EURASIA', longitude: 90, latitude: 52, range: { nearZoom: 6.6, farZoom: 7.6 } },
  { text: 'NORTH AMERICA', longitude: -102, latitude: 50, range: { nearZoom: 6.6, farZoom: 7.6 } },
  { text: 'PACIFIC OCEAN', longitude: -165, latitude: 28, range: { nearZoom: 6.6, farZoom: 7.6 } },
  { text: 'AFRICA', longitude: 20, latitude: 8, range: { nearZoom: 6.9, farZoom: 7.6 } },
  { text: 'VANCOUVER ISLAND', longitude: -125.9, latitude: 49.8, range: { nearZoom: 5.2, farZoom: 6.6 } },
  { text: 'PACIFIC OCEAN', longitude: -128.3, latitude: 47.6, range: { nearZoom: 5.2, farZoom: 6.4 } },
  { text: 'SALISH SEA', longitude: -123.35, latitude: 49.1, range: { nearZoom: 5.0, farZoom: 6.2 } },
  { text: 'OLYMPIC PENINSULA', longitude: -123.6, latitude: 47.75, range: { nearZoom: 5.0, farZoom: 6.1 } },
  { text: 'JUAN DE FUCA STRAIT', longitude: -123.95, latitude: 48.26, range: { nearZoom: 4.2, farZoom: 5.4 } },
  {
    text: 'FUTURE VICTORIA · NO ONE HERE YET',
    longitude: -123.37,
    latitude: 48.445,
    range: { nearZoom: 4.1, farZoom: 5.1 },
  },
];

export const DIVE_WORLD_LABELS: readonly DiveWorldLabel[] = [
  { text: 'A ROCKY POINT, LOW TIDE', x: 0, y: -120, range: { nearZoom: 2.6, farZoom: 4.2 } },
  // `KELP_BED_LABEL`
  { text: 'BULL KELP BED', x: 180, y: 70, range: { nearZoom: 1.8, farZoom: 3.1 } },
  // `FIXED_POOL`
  { text: 'TIDE POOL', x: -9, y: -6, range: { nearZoom: 1.0, farZoom: 2.1 } },
  // `FOCAL_ROCK` − (1.2, 1.3)
  { text: 'BOULDER WITH A STRANDED BULL KELP', x: -1.05, y: -1.85, range: { nearZoom: 0.35, farZoom: 1.55 } },
  // `BULB`
  { text: 'BULB (FLOAT), ~13 cm', x: 0.9, y: 0.45, range: { nearZoom: -0.55, farZoom: 0.6 } },
  { text: 'BLADE', x: -1.3, y: -0.62, range: { nearZoom: -0.2, farZoom: 0.7 } },
  // `DROP`'s top
  { text: 'A DROP OF SEA SPRAY, 5 mm', x: 0.0014, y: -0.0016, range: { nearZoom: -2.3, farZoom: -1.1 } },
  // `DROP`'s rim nearest the focus
  { text: 'EDGE OF THE DROP', x: -0.000703, y: -0.000452, range: { nearZoom: -3.4, farZoom: -2.25 } },
  { text: 'COPEPOD LARVA, 0.25 mm', x: 5.2e-4, y: -4.7e-4, range: { nearZoom: -3.5, farZoom: -2.35 } },
  { text: 'CILIATE, 0.1 mm', x: -3.0e-4, y: 1.0e-4, range: { nearZoom: -3.7, farZoom: -2.5 } },
  { text: 'KELP SURFACE CELLS, ~12 µm', x: 1.9e-4, y: -1.2e-4, range: { nearZoom: -3.9, farZoom: -3.2 } },
  { text: 'DIATOM, 70 µm (BIGGER THAN THE DISH)', x: 3.8e-5, y: -2.4e-5, range: { nearZoom: -4.7, farZoom: -3.6 } },
  // `POCKET_R` + 2 µm above the centre
  { text: 'THE DISH: A POCKET OF WATER 40 µm ACROSS', x: 0, y: -22e-6, range: { nearZoom: -4.9, farZoom: -3.75 } },
  { text: 'BACTERIA, 1–3 µm', x: -9e-6, y: 8e-6, range: { nearZoom: -5.5, farZoom: -4.5 } },
  { text: 'YOU: 1.6 µm', x: 0, y: -1.2e-6, range: { nearZoom: -6.5, farZoom: -5.05 } },
];
