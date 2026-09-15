// Viewport culling (docs/architecture/wire-contract.md §4.2 lever 1): each viewer is sent only the food and the DNA
// fragments inside its interest area, the view of its camera (`simulation/camera-follow.ts`, which the server runs per
// viewer) over its last few broadcasts, grown by a margin. The margin is derived from the cadence, the client's
// render delay and the speeds, so a mote or a fragment enters or leaves a viewer's stream only outside its canvas.

import { SPRINT_SPEED_MULTIPLIER } from './controls.js';
import {
  ALGAE_RADIUS,
  BACTERIUM_DRIFT_SPEED,
  BACTERIUM_RADIUS,
  DETRITUS_RADIUS,
  DNA_FRAGMENT_DRIFT_SPEED,
  DNA_FRAGMENT_RADIUS,
} from './ecology.js';
import { CELL_BASE_SPEED } from './growth.js';
import { INTERPOLATION_DELAY_TICKS, MAX_EXTRAPOLATION_TICKS, SNAPSHOT_EVERY_TICKS } from './netcode.js';
import { TICK_INTERVAL_S } from './network.js';
import { TRAIT_TIERS } from './traits.js';

/**
 * The widest canvas, width over height, whose sides are never culled. The vertical extent is authoritative
 * (docs/game-design/controls-and-scope.md §7) and the server is not told the canvas, so this covers a 21:9 screen
 * and a maximised browser window on a 16:9 or 16:10 one (about 2); a wider canvas sees food appear at its far sides.
 */
export const INTEREST_VIEW_ASPECT_RATIO = 2.4;

/**
 * Camera states the area spans: the newest, the broadcasts the client renders behind it
 * (`INTERPOLATION_DELAY_TICKS`), and one more for a snapshot that arrives late.
 */
export const INTEREST_CAMERA_HISTORY_BROADCASTS = Math.ceil(INTERPOLATION_DELAY_TICKS / SNAPSHOT_EVERY_TICKS) + 2;

/** How far a mote or a fragment is drawn, in its radii: the widest food glow (`ALGAE_GLOW.wide`, 3) and one more. */
export const INTEREST_ENTITY_REACH_RADII = 4;

const TIERS_OF_EVERY_TRAIT = Object.values(TRAIT_TIERS);
const IDENTITY_MULTIPLIER = 1;
const IDENTITY_BONUS = 0;

/**
 * The fastest a cell can move (wu/s): `CELL_BASE_SPEED` under every trait's best speed tier, sprinting with every
 * trait's best sprint bonus. An upper bound: no build owns every trait.
 */
export const INTEREST_MAX_CELL_SPEED =
  CELL_BASE_SPEED *
  TIERS_OF_EVERY_TRAIT.reduce(
    (product, tiers) =>
      product * Math.max(IDENTITY_MULTIPLIER, ...tiers.map((tier) => tier.speedMultiplier ?? IDENTITY_MULTIPLIER)),
    IDENTITY_MULTIPLIER,
  ) *
  (SPRINT_SPEED_MULTIPLIER +
    TIERS_OF_EVERY_TRAIT.reduce(
      (sum, tiers) =>
        sum + Math.max(IDENTITY_BONUS, ...tiers.map((tier) => tier.sprintSpeedMultiplierBonus ?? IDENTITY_BONUS)),
      IDENTITY_BONUS,
    ));

/** The fastest a mote or a fragment moves (wu/s): a bacterium's walk, a fragment's drift or a mote an eyespot pulls. */
export const INTEREST_MAX_FOOD_SPEED = Math.max(
  BACTERIUM_DRIFT_SPEED,
  DNA_FRAGMENT_DRIFT_SPEED,
  ...TIERS_OF_EVERY_TRAIT.flatMap((tiers) => tiers.map((tier) => tier.attractSpeed ?? IDENTITY_BONUS)),
);

/** Ticks the client's camera can run ahead of the server's newest state: the extrapolation, and one broadcast step. */
const CAMERA_LEAD_TICKS = MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS;
/** Ticks a drawn mote can trail the snapshot that last placed it: the render delay, the extrapolation, one interval. */
const FOOD_LAG_TICKS = INTERPOLATION_DELAY_TICKS + MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS;
const LARGEST_FOOD_RADIUS = Math.max(ALGAE_RADIUS, BACTERIUM_RADIUS, DETRITUS_RADIUS, DNA_FRAGMENT_RADIUS);

/**
 * What the area adds around each camera's view (wu): how far the client's camera can lead the server's, how far a
 * mote can move before the client draws where it is, and how far past its centre a mote is drawn.
 */
export const INTEREST_MARGIN_WU = Math.ceil(
  CAMERA_LEAD_TICKS * TICK_INTERVAL_S * INTEREST_MAX_CELL_SPEED +
    FOOD_LAG_TICKS * TICK_INTERVAL_S * INTEREST_MAX_FOOD_SPEED +
    INTEREST_ENTITY_REACH_RADII * LARGEST_FOOD_RADIUS,
);
