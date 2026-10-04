// The opening dive's bacteria and food specks in the slime and its pocket (docs/rendering/opening-dive.md §4, ticket
// #803): the mockup's `drawBacteria`, `ROD_KINDS`, `rodArt`, `rodSprite`, `moteSprite` and `mote` numbers under its own
// names. Metres round the focus; a sprite's numbers are its canvas's px. Kept out of the `render/constants` barrel:
// only the dive's lazily loaded slime chunk reads it.

import {
  BACTERIUM_PLAIN,
  CHLORO_BASE,
  CHLORO_DARK,
  CHLORO_LIGHT,
  FOOD_MOTE,
  FOOD_MOTE_EDGE,
  FOOD_MOTE_RIM,
  LIPID_BASE,
  LIPID_CENTRE,
  LIPID_RIM,
  MITO_BASE,
  MITO_LIGHT,
  PROTO_FILM,
} from './colours';

/** A rod's look (`ROD_KINDS`): its body, rim and halo colours, the body's alpha, the halo's, and banding if any. */
export interface SlimeRodKind {
  readonly body: string;
  readonly rim: string;
  readonly alpha: number;
  readonly halo: string;
  readonly haloAlpha: number;
  readonly bands: string | null;
}

/** Plain, mitochondrial orange and banded green: the game's food vocabulary at true sizes. */
export const SLIME_ROD_KINDS: readonly SlimeRodKind[] = [
  { body: BACTERIUM_PLAIN, rim: PROTO_FILM, alpha: 0.55, halo: PROTO_FILM, haloAlpha: 0.22, bands: null },
  { body: MITO_BASE, rim: MITO_LIGHT, alpha: 0.78, halo: MITO_BASE, haloAlpha: 0.3, bands: null },
  { body: CHLORO_BASE, rim: CHLORO_LIGHT, alpha: 0.78, halo: CHLORO_LIGHT, haloAlpha: 0.3, bands: CHLORO_DARK },
];

/**
 * The bacteria (`drawBacteria`'s rods): a `cellM` grid, drawn while a micrometre spans `minPxPerMicron`, under the cell
 * cap. None within `clearOfFocusM`; inside `inDishRadii` pocket radii a cell is in the dish (kept at or under
 * `keep.inDish`), and none between that and `clearOfWallRadii`; outside, kept at or under `keep.slime`. `kindRolls` pick
 * the kind in the dish and in the slime; each is `lengthM` long and `widthM` wide (its own salt) and drifts
 * `driftM` round its place (`rates` in radians a second, `phase` per column and row) and turns a little.
 */
export const SLIME_RODS = {
  cellM: 3.4e-6,
  salt: 101,
  maxCells: 7000,
  minPxPerMicron: 1.2,
  micronM: 1e-6,
  clearOfFocusM: 2.6e-6,
  inDishRadii: 0.93,
  clearOfWallRadii: 1.14,
  keepSalt: 107,
  keep: { inDish: 0.16, slime: 0.3 },
  kindRolls: { inDish: [0.5, 0.78], slime: [0.82, 0.93] },
  lengthM: { min: 1.1e-6, span: 1.5e-6 },
  widthM: { min: 0.5e-6, span: 0.25e-6, salt: 105 },
  angleSalt: 106,
  driftM: 0.35e-6,
  phase: { column: 1.7, row: 2.3, yScale: 1.3 },
  rates: { x: 0.35, y: 0.29, turn: 0.2 },
  turn: 0.25,
  alpha: { slime: 0.35, slimeDarkField: 0.25 },
  minPx: 1.5,
  /** Over this many px long a rod is drawn whole rather than from its sprite: the slime never gets that close. */
  spriteBelowPx: 150,
} as const;

/** A rod's sprite (`rodSprite`, `rodArt`): a `length × width` px rod in the middle of a `canvas` px canvas. */
export const SLIME_ROD_SPRITE = {
  canvas: { width: 256, height: 160 },
  length: 150,
  width: 70,
  halo: { reachX: 0.8, reachY: 1.3 },
  body: { fromX: -0.2, fromY: -0.5, fromRadius: 0.1, toX: 0.05, toY: 0.2, toRadius: 0.6, stop: 0.5, edgeAlpha: 0.7 },
  bands: { at: [-0.25, 0, 0.25], width: 0.18, alpha: 0.55 },
  innerEdge: { width: 0.12, alpha: 0.5 },
  rim: { width: 0.1, stops: [0.3, 0.7] },
  glint: { x: -0.28, y: -0.42, radius: 0.28, alpha: 0.95 },
} as const;

/** A food speck's look (`moteSprite`): algae green, or a lipid's gold, elongated and turned. */
export interface SlimeMoteKind {
  readonly core: string;
  readonly edge: string;
  readonly rim: string;
  readonly isLipid: boolean;
}

export const SLIME_MOTE_KINDS: readonly SlimeMoteKind[] = [
  { core: FOOD_MOTE, edge: FOOD_MOTE_EDGE, rim: FOOD_MOTE_RIM, isLipid: false },
  { core: LIPID_BASE, edge: LIPID_CENTRE, rim: LIPID_RIM, isLipid: true },
];

/**
 * The food specks (`drawBacteria`'s motes): a `cellM` grid, under the cell cap, within `reachRadii` pocket radii and
 * not within `clearOfFocusM`; kept while the roll is at or under `keep.inDish` / `keep.slime`, a lipid under
 * `lipidBelow`; `radiusM.min + radiusM.span × b`, drifting `driftM`. Drawn while its radius spans `minPx`.
 */
export const SLIME_MOTES = {
  cellM: 1.5e-6,
  salt: 111,
  maxCells: 9000,
  clearOfFocusM: 1.6e-6,
  reachRadii: 3,
  keep: { inDish: 0.045, slime: 0.02 },
  lipidBelow: 0.008,
  radiusM: { min: 0.16e-6, span: 0.22e-6 },
  driftM: 0.12e-6,
  rates: { x: 0.5, y: 0.43 },
  minPx: 0.6,
  visibleRadii: 4,
} as const;

/** A speck's sprite (`moteSprite`): `size` px square, the body `bodyShare` of it in radius, its halo and lights. */
export const SLIME_MOTE_SPRITE = {
  size: 96,
  bodyShare: 0.16,
  halo: { alpha: 0.5, middleStop: 0.3, middleAlpha: 0.16 },
  body: { lightOffset: 0.35, core: 0.1, stop: 0.5 },
  lipid: { radiusX: 1.2, radiusY: 0.85, turn: 0.5 },
  rimWidthPx: 1.2,
  glint: { offset: 0.4, radius: 0.22, alpha: 0.9 },
} as const;
