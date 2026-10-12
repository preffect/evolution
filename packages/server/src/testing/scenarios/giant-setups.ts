// What the giants' decision rows share (docs/ecology/acceptance.md §8.2 G3–G7): selectors over a species' giant and
// its seat, the placed giant and player A, the wander check and the heading error. Not a test file; the giant scenario
// files import it.

import { DEFAULT_BALANCE, type GiantSpecies, type Vec2 } from '@evolution/shared';
import { giantCellOf, giantSeatOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { angleBetweenDegrees, placedSolo } from './shared-setups.js';

const { controls } = DEFAULT_BALANCE;
/** Seat 24 (the amoeba's) decides on tick 24, seat 25 (the paramecium's) on 25, seat 26 (the diatom's) on 26. */
export const AMOEBA_DECISION_TICK = 24;
export const PARAMECIUM_DECISION_TICK = 25;
export const DIATOM_DECISION_TICK = 26;
/** "A wander target": within this of own centre + heading × 2 radii. */
const WANDER_TOLERANCE_WU = 1e-6;

/** A point `distanceWu` due east of the broth point. */
export function eastOfBroth(distanceWu: number): Vec2 {
  return { x: BROTH_POINT.x + distanceWu, y: BROTH_POINT.y };
}

/** The placed giant of a G row: its species and born mass. */
export interface PlacedGiantRow {
  readonly species: GiantSpecies;
  readonly bornMass: number;
}

/** The G rows' player A: its mass and how far east of the giant it sits. */
export interface PlacedPlayerRow {
  readonly mass: number;
  readonly eastWu: number;
}

/** The giant at the broth point and A, idle unless the row scripts it, `eastWu` east of it. */
export function giantAndA(name: string, giant: PlacedGiantRow, playerA: PlacedPlayerRow) {
  return placedSolo(name)
    .placeGiant({ ...giant, at: BROTH_POINT })
    .placeCell({ playerIndex: 0, mass: playerA.mass, at: eastOfBroth(playerA.eastWu) });
}

/** The giant seat's latched target, or `undefined` while it has none. */
export const giantTarget =
  (species: GiantSpecies) =>
  (view: EvolutionView): Vec2 | undefined => {
    const seat = giantSeatOf(view, species);
    return seat === undefined || seat.targetX === null || seat.targetY === null
      ? undefined
      : { x: seat.targetX, y: seat.targetY };
  };

export const giantSpeedOf =
  (species: GiantSpecies) =>
  (view: EvolutionView): number | undefined => {
    const giant = giantCellOf(view, species);
    return giant === undefined ? undefined : Math.hypot(giant.velocityX, giant.velocityY);
  };

/** What a decision row captures the tick before the decision, while the giant still sits where it was placed. */
export const CENTRE_BEFORE_DECISION = 'giant centre before its decision';

/** The giant's centre (`capture` it under `CENTRE_BEFORE_DECISION` the tick before the decision). */
export const giantCentre =
  (species: GiantSpecies) =>
  (view: EvolutionView): Vec2 | undefined => {
    const giant = giantCellOf(view, species);
    return giant === undefined ? undefined : { x: giant.x, y: giant.y };
  };

/**
 * Whether the giant's target is the wander's: its centre at the decision (captured the tick before, since step 3 of the
 * decision's tick moves it) + its seat's heading × `STEER_FULL_THROTTLE_RADII` radii.
 */
export const isWanderTargetOf =
  (species: GiantSpecies) =>
  (view: EvolutionView): boolean => {
    const giant = giantCellOf(view, species);
    const seat = giantSeatOf(view, species);
    const target = giantTarget(species)(view);
    const centre = view.captured(CENTRE_BEFORE_DECISION) as Vec2 | undefined;
    if (giant === undefined || seat === undefined || target === undefined || centre === undefined) {
      return false;
    }
    const reach = controls.STEER_FULL_THROTTLE_RADII * giant.radius;
    const wanderX = centre.x + seat.headingX * reach;
    const wanderY = centre.y + seat.headingY * reach;
    return Math.hypot(target.x - wanderX, target.y - wanderY) <= WANDER_TOLERANCE_WU;
  };

/** The angle (°) between the giant's velocity and `direction`; 0 = straight along it. */
export const giantHeadingErrorFrom =
  (species: GiantSpecies, direction: Vec2) =>
  (view: EvolutionView): number | undefined => {
    const giant = giantCellOf(view, species);
    if (giant === undefined) {
      return undefined;
    }
    return angleBetweenDegrees({ x: giant.velocityX, y: giant.velocityY }, direction);
  };
