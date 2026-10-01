// The dive's dish scene (docs/rendering/opening-dive.md §4): the bottom of the dive drawn by the game's own renderer
// from a scripted scene, never a room snapshot. Your cell sits at the dish centre in the first seat's colour; the
// dish holds seeded bacteria (wild cells, in the cell shader) and specks of food (the food layer's motes). The frame
// is built the way the encyclopedia preview builds its own (`preview/preview-frame.ts`), so the renderer cannot
// tell it from a room's, and nothing it draws is forked.
//
// Sizes are the dive's: the game's dish is the 40 µm pocket (`DIVE_METRES_PER_WU`); your cell (1.6 µm) and each
// bacterium (1.1–1.6 µm, `DIVE_BACTERIUM_DIAMETER_M`) are drawn true to size, their masses derived through the live
// growth curve. The specks keep the food layer's own size in world units.

import {
  CELL_KIND,
  COSMETIC_SUB_STREAM,
  DISH_RADIUS,
  FIRST_LEVEL,
  FOOD_KIND,
  RADIANS_PER_FULL_TURN,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  createSeededRandom,
  entityId,
  type BalanceConfig,
  type CellView,
  type FoodMoteView,
  type RandomSource,
} from '@evolution/shared';
import type { RenderFrame } from '../../net/world-store';
import type { RenderTextureOptions } from '../render-textures';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import {
  DIVE_BACTERIA_COUNT,
  DIVE_BAKE_DEVICE_PIXEL_RATIO,
  DIVE_BACTERIUM_DIAMETER_M,
  DIVE_BACTERIUM_DRIFT_M,
  DIVE_BACTERIUM_DRIFT_PERIOD_SECONDS,
  DIVE_DETRITUS_SHARE,
  DIVE_FOOD_SPREAD_FRACTION,
  DIVE_METRES_PER_WU,
  DIVE_MOTE_COUNT,
  DIVE_OWN_AVATAR_INDEX,
  DIVE_OWN_CELL_CLEARANCE_RADII,
  DIVE_OWN_CELL_DIAMETER_M,
  DIVE_SEED,
} from '../constants';
import { HALF } from '../geometry';
import { previewCellView, previewRenderFrame } from '../preview/preview-frame';
import { actionSubjectOwnCellIndicators } from '../preview/scenes/action-subject';
import { PREVIEW_SUBJECT_PLAYER_ID } from '../preview/scenes/cell-scene';

/**
 * Your cell is the preview's subject player, so the HUD's own-cell record is built exactly as the encyclopedia
 * lens builds it (`actionSubjectOwnCellIndicators`): the self ring reads what it reads in play.
 */
export const DIVE_OWN_PLAYER_ID = PREVIEW_SUBJECT_PLAYER_ID;
const OWN_CELL_ID = 'dive-you';
const NO_FRAGMENTS = [] as const;
const NO_EFFECTS = [] as const;
const NO_TRAITS = [] as const;
/** The bacteria's second drift axis runs at a slightly different rate, so a drift is a loop rather than a line. */
const DRIFT_SECOND_AXIS_RATE = 0.83;

/** A width in metres as a radius in world units, at the dive's scale. */
function radiusWuOf(diameterM: number): number {
  return (diameterM * HALF) / DIVE_METRES_PER_WU;
}

/** The mass whose radius on the live growth curve is `radiusWu` (`radius = scale × √mass`). */
export function massForRadius(radiusWu: number, balance: BalanceConfig): number {
  const rootMass = radiusWu / balance.growth.CELL_RADIUS_SCALE;
  return rootMass * rootMass;
}

/** Your cell's radius in world units: the mockup's 1.6 µm. */
export const DIVE_OWN_CELL_RADIUS_WU = radiusWuOf(DIVE_OWN_CELL_DIAMETER_M);

interface ScenePlace {
  readonly x: number;
  readonly y: number;
  /** Where this body starts on its drift loop, in turns. */
  readonly phase: number;
  /** A uniform draw that picks its size or kind. */
  readonly pick: number;
}

/** A place in the dish's open water, clear of your cell and of the wall (uniform over the annulus). */
function scenePlace(random: RandomSource): ScenePlace {
  const inner = DIVE_OWN_CELL_RADIUS_WU * DIVE_OWN_CELL_CLEARANCE_RADII;
  const outer = DISH_RADIUS * DIVE_FOOD_SPREAD_FRACTION;
  const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const distance = Math.sqrt(inner * inner + random.nextFloat() * (outer * outer - inner * inner));
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    phase: random.nextFloat(),
    pick: random.nextFloat(),
  };
}

function drifted(place: ScenePlace, timeSeconds: number): { readonly x: number; readonly y: number } {
  const amplitude = DIVE_BACTERIUM_DRIFT_M / DIVE_METRES_PER_WU;
  const angle = RADIANS_PER_FULL_TURN * (place.phase + timeSeconds / DIVE_BACTERIUM_DRIFT_PERIOD_SECONDS);
  return {
    x: place.x + Math.sin(angle) * amplitude,
    y: place.y + Math.cos(angle * DRIFT_SECOND_AXIS_RATE) * amplitude,
  };
}

function bacteriumView(place: ScenePlace, index: number, timeSeconds: number, balance: BalanceConfig): CellView {
  const { smallest, largest } = DIVE_BACTERIUM_DIAMETER_M;
  const radiusWu = radiusWuOf(smallest + (largest - smallest) * place.pick);
  return previewCellView(
    {
      id: `dive-bacterium-${index}`,
      kind: CELL_KIND.wild,
      playerId: null,
      avatarIndex: DIVE_OWN_AVATAR_INDEX,
      mass: massForRadius(radiusWu, balance),
      traits: NO_TRAITS,
      ...drifted(place, timeSeconds),
      velocityX: 0,
      velocityY: 0,
    },
    balance,
  );
}

function speckView(place: ScenePlace, index: number): FoodMoteView {
  return {
    id: entityId(`dive-speck-${index}`),
    kind: place.pick < DIVE_DETRITUS_SHARE ? FOOD_KIND.detritus : FOOD_KIND.algae,
    bacteriumVariant: null,
    x: place.x,
    y: place.y,
  };
}

function ownCellView(balance: BalanceConfig): CellView {
  return previewCellView(
    {
      id: OWN_CELL_ID,
      kind: CELL_KIND.player,
      playerId: DIVE_OWN_PLAYER_ID,
      avatarIndex: DIVE_OWN_AVATAR_INDEX,
      mass: massForRadius(DIVE_OWN_CELL_RADIUS_WU, balance),
      traits: NO_TRAITS,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      level: FIRST_LEVEL,
    },
    balance,
  );
}

export interface DiveMicroScene {
  /** The scene at `timeSeconds` as the renderer takes it; the render tick is that time in ticks. */
  frameAt(timeSeconds: number, balance: BalanceConfig): RenderFrame;
  /** The HUD's own-cell record for that frame: the self ring round your cell. */
  ownCellIndicators(frame: RenderFrame): OwnCellIndicators | null;
}

export function createDiveMicroScene(): DiveMicroScene {
  const random = createSeededRandom(DIVE_SEED).fork(`${RANDOM_STREAM.cosmetic}:${COSMETIC_SUB_STREAM.dive}`);
  const bacteria = Array.from({ length: DIVE_BACTERIA_COUNT }, () => scenePlace(random));
  const specks = Array.from({ length: DIVE_MOTE_COUNT }, () => scenePlace(random)).map(speckView);
  return {
    frameAt: (timeSeconds, balance) => {
      const cells = [
        ownCellView(balance),
        ...bacteria.map((place, index) => bacteriumView(place, index, timeSeconds, balance)),
      ];
      const scene = { cells, motes: specks, fragments: NO_FRAGMENTS, effects: NO_EFFECTS };
      return previewRenderFrame({ renderTick: timeSeconds / TICK_INTERVAL_S, scene, balance });
    },
    ownCellIndicators: (frame) => actionSubjectOwnCellIndicators(frame, frame.balance),
  };
}

/**
 * The textures the dive's renderer bakes for its scene: seeded through `cosmetic:dive`, at the organelle atlas's
 * highest ratio whatever the screen's (so your cell holds its detail down to the dive's bottom), and with the field's
 * warm vent tint off, since the vent sprite is hidden too: your cell is the dive's end.
 */
export function diveTextureOptions(noiseTileSizePx: number | undefined): Omit<RenderTextureOptions, 'baker'> {
  return {
    seed: DIVE_SEED,
    gelPatches: [],
    devicePixelRatio: DIVE_BAKE_DEVICE_PIXEL_RATIO,
    noiseTileSizePx,
    isVentTinted: false,
  };
}
