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
  { text: 'Eurasia', longitude: 90, latitude: 52, range: { nearZoom: 6.6, farZoom: 7.6 } },
  { text: 'North America', longitude: -102, latitude: 50, range: { nearZoom: 6.6, farZoom: 7.6 } },
  { text: 'Pacific Ocean', longitude: -165, latitude: 28, range: { nearZoom: 6.6, farZoom: 7.6 } },
  { text: 'Africa', longitude: 20, latitude: 8, range: { nearZoom: 6.9, farZoom: 7.6 } },
  { text: 'Vancouver Island', longitude: -125.9, latitude: 49.8, range: { nearZoom: 5.2, farZoom: 6.6 } },
  { text: 'Pacific Ocean', longitude: -128.3, latitude: 47.6, range: { nearZoom: 5.2, farZoom: 6.4 } },
  { text: 'Salish Sea', longitude: -123.35, latitude: 49.1, range: { nearZoom: 5.0, farZoom: 6.2 } },
  { text: 'Olympic Peninsula', longitude: -123.6, latitude: 47.75, range: { nearZoom: 5.0, farZoom: 6.1 } },
  { text: 'Juan de Fuca Strait', longitude: -123.95, latitude: 48.26, range: { nearZoom: 4.2, farZoom: 5.4 } },
  {
    text: 'Future Victoria · no one here yet',
    longitude: -123.37,
    latitude: 48.445,
    range: { nearZoom: 4.1, farZoom: 5.1 },
  },
];

export const DIVE_WORLD_LABELS: readonly DiveWorldLabel[] = [
  { text: 'A rocky point, low tide', x: 0, y: -120, range: { nearZoom: 2.6, farZoom: 4.2 } },
  // `KELP_BED_LABEL`
  { text: 'Bull kelp bed', x: 180, y: 70, range: { nearZoom: 1.8, farZoom: 3.1 } },
  // `FIXED_POOL`
  { text: 'Tide pool', x: -9, y: -6, range: { nearZoom: 1.0, farZoom: 2.1 } },
  // `FOCAL_ROCK` − (1.2, 1.3)
  { text: 'Boulder with a stranded bull kelp', x: -1.05, y: -1.85, range: { nearZoom: 0.35, farZoom: 1.55 } },
  // `BULB`
  { text: 'Bulb (float), ~13 cm', x: 0.9, y: 0.45, range: { nearZoom: -0.55, farZoom: 0.6 } },
  { text: 'Blade', x: -1.3, y: -0.62, range: { nearZoom: -0.2, farZoom: 0.7 } },
  // `DROP`'s top
  { text: 'A drop of sea spray, 5 mm', x: 0.0014, y: -0.0016, range: { nearZoom: -2.3, farZoom: -1.1 } },
  // `DROP`'s rim nearest the focus
  { text: 'Edge of the drop', x: -0.000703, y: -0.000452, range: { nearZoom: -3.4, farZoom: -2.25 } },
  { text: 'Copepod larva, 0.25 mm', x: 5.2e-4, y: -4.7e-4, range: { nearZoom: -3.5, farZoom: -2.35 } },
  { text: 'Ciliate, 0.1 mm', x: -3.0e-4, y: 1.0e-4, range: { nearZoom: -3.7, farZoom: -2.5 } },
  { text: 'Kelp surface cells, ~12 µm', x: 1.9e-4, y: -1.2e-4, range: { nearZoom: -3.9, farZoom: -3.2 } },
  { text: 'Diatom, 70 µm (bigger than the dish)', x: 3.8e-5, y: -2.4e-5, range: { nearZoom: -4.7, farZoom: -3.6 } },
  // `POCKET_R` + 2 µm above the centre
  { text: 'The dish: a pocket of water 40 µm across', x: 0, y: -22e-6, range: { nearZoom: -4.9, farZoom: -3.75 } },
  { text: 'Bacteria, 1–3 µm', x: -9e-6, y: 8e-6, range: { nearZoom: -5.5, farZoom: -4.5 } },
  { text: 'You: 1.6 µm', x: 0, y: -1.2e-6, range: { nearZoom: -6.5, farZoom: -5.05 } },
];
