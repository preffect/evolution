// The dive's band table (docs/rendering/opening-dive.md §3): which bands draw at a camera and how far each is faded
// in. Bands nest: each draws in its own metres around the focus, fades in as the dive falls into its range, and
// stops drawing once the view has passed it. The table is the one place those windows live — the mockup's drawing
// (`mockup/dive-mockup-bands.js`) and the game's renderer both read their weights from here.

import { DISH_RADIUS } from '@evolution/shared';
import {
  DIVE_DISH_MIN_RADIUS_PX,
  DIVE_DISH_WINDOW,
  DIVE_DROP_WINDOW,
  DIVE_KELP_WINDOW,
  DIVE_METRES_PER_WU,
  DIVE_PLANET_WINDOW,
  DIVE_SHORE_WINDOW,
  DIVE_SLIME_WINDOW,
  WALL_GLASS_OUTER_WU,
  WALL_GLASS_WU,
  type DiveBandWindow,
} from '../constants';
import { smoothstep } from '../geometry';
import { diveViewReachM, type DiveCamera } from './dive-camera';

/** The bands, top to bottom. Only `dish` is drawn by the game's renderer; the rest are the mockup's for now. */
export const DIVE_BAND = {
  planet: 'planet',
  shore: 'shore',
  kelp: 'kelp',
  drop: 'drop',
  slime: 'slime',
  dish: 'dish',
} as const;
export type DiveBandName = (typeof DIVE_BAND)[keyof typeof DIVE_BAND];
export const DIVE_BAND_NAMES: readonly DiveBandName[] = Object.values(DIVE_BAND);

/** The bands the mockup's canvas draws; the dish is the game's. */
export const DIVE_MOCKUP_BAND_NAMES: readonly DiveBandName[] = DIVE_BAND_NAMES.filter(
  (name) => name !== DIVE_BAND.dish,
);

export interface DiveBandState {
  /** How far the band is faded in, 0 → 1. */
  readonly weight: number;
  /** Whether it draws at all this frame: faded in and not yet passed. */
  readonly isActive: boolean;
}

export type DiveBandStates = Readonly<Record<DiveBandName, DiveBandState>>;

export const DIVE_BAND_WINDOWS: Readonly<Record<DiveBandName, DiveBandWindow>> = {
  planet: DIVE_PLANET_WINDOW,
  shore: DIVE_SHORE_WINDOW,
  kelp: DIVE_KELP_WINDOW,
  drop: DIVE_DROP_WINDOW,
  slime: DIVE_SLIME_WINDOW,
  dish: DIVE_DISH_WINDOW,
};

/** The dish's radius in metres: the game's `DISH_RADIUS` at the dive's scale. */
export const DIVE_DISH_RADIUS_M = DISH_RADIUS * DIVE_METRES_PER_WU;

/** The game's dish is drawn out to its wall's outer glass; the slime beyond it is the mockup's. */
export const DIVE_DISH_CLIP_RADIUS_WU = DISH_RADIUS + WALL_GLASS_WU + WALL_GLASS_OUTER_WU;

/** A window's fade at `zoom`: 0 above its fade, 1 below it, smoothstepped between; 1 when it has no fade. */
export function bandWeight(window: DiveBandWindow, zoom: number): number {
  if (window.fadeFromZoom === null || window.fadeToZoom === null) return 1;
  return smoothstep(window.fadeFromZoom, window.fadeToZoom, zoom);
}

/** Whether the window's zoom cut lets it draw: strictly above the cut, as the mockup's `z > cut`. */
function isAboveCut(window: DiveBandWindow, zoom: number): boolean {
  return window.cutAtZoom === null || zoom > window.cutAtZoom;
}

/**
 * The camera cuts: the slime is drawn round the dish only while the view reaches past the dish (inside it, the
 * game's dish covers everything), and the game's dish only once it is big enough to see.
 */
function passesCameraCut(name: DiveBandName, camera: DiveCamera): boolean {
  if (name === DIVE_BAND.slime) return diveViewReachM(camera) > DIVE_DISH_RADIUS_M;
  if (name === DIVE_BAND.dish) return DIVE_DISH_RADIUS_M * camera.pixelsPerMetre >= DIVE_DISH_MIN_RADIUS_PX;
  return true;
}

function bandState(name: DiveBandName, camera: DiveCamera): DiveBandState {
  const window = DIVE_BAND_WINDOWS[name];
  const weight = bandWeight(window, camera.zoom);
  return { weight, isActive: weight > 0 && isAboveCut(window, camera.zoom) && passesCameraCut(name, camera) };
}

/** Every band's state at `camera`. */
export function diveBandStates(camera: DiveCamera): DiveBandStates {
  const states = {} as Record<DiveBandName, DiveBandState>;
  for (const name of DIVE_BAND_NAMES) states[name] = bandState(name, camera);
  return states;
}

/** Whether any of the mockup's bands draws: when none does, its canvas is neither drawn nor uploaded. */
export function isMockupDrawing(states: DiveBandStates): boolean {
  return DIVE_MOCKUP_BAND_NAMES.some((name) => states[name].isActive);
}

/** The bands that draw this frame, top first: what a frame's time is charged to in the evidence. */
export function activeDiveBands(states: DiveBandStates): readonly DiveBandName[] {
  return DIVE_BAND_NAMES.filter((name) => states[name].isActive);
}
