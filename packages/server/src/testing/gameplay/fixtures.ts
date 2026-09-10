// Fixture helpers the scenario tables share (docs/ECOLOGY.md §8): the placement convention, the
// `decayed()` mass formula and the placed-entity records an adapter applies before tick 1. The
// literals here ARE the convention the design states (a fixture default is the one tolerated
// inline test number, docs/TESTING.md §4); the balance numbers themselves are injected, because
// `constants/ecology.ts` and `constants/world.ts` land with #98 and this file must not grow a
// second copy of them.

import { TICK_HZ, type Vec2 } from '@evolution/shared';
import { ScenarioSetupError } from './errors.js';

/** Mid-broth, 1000 wu from both the vent and the shallows: no wall, vent or light effect reaches it. */
export const BROTH_POINT: Vec2 = { x: 1500, y: 0 };
/** "In the vent" = the origin. */
export const VENT_POINT: Vec2 = { x: 0, y: 0 };
/** A seeded gel patch this close to the broth point invalidates the seed for placed rows. */
export const GEL_PATCH_CLEARANCE_WU = 350;
/** The zone × trait decay multiplier when nothing modifies decay. */
export const DEFAULT_DECAY_MULTIPLIER = 1;

/** "In the shallows" = (`DISH_RADIUS` − `SHALLOWS_WIDTH` / 2, 0). */
export function shallowsPoint(dishRadiusWu: number, shallowsWidthWu: number): Vec2 {
  return { x: dishRadiusWu - shallowsWidthWu / 2, y: 0 };
}

export function isClearOfGelPatches(point: Vec2, patchCentres: readonly Vec2[], clearanceWu: number): boolean {
  return patchCentres.every((centre) => Math.hypot(centre.x - point.x, centre.y - point.y) >= clearanceWu);
}

export interface DecayConstants {
  readonly cellStartingMass: number;
  readonly massDecayRatePerSecond: number;
}

/**
 * `decayed(m, n, k)` = starting + (m − starting) × (1 − rate × k / TICK_HZ)^n: the mass a placed
 * cell of mass `m` has after `n` ticks under decay multiplier `k`. Bound once per scenario table
 * from `DEFAULT_BALANCE` (#98): `const decayed = createDecayedHelper({ ... })`.
 */
export function createDecayedHelper(constants: DecayConstants) {
  return (mass: number, ticks: number, decayMultiplier = DEFAULT_DECAY_MULTIPLIER): number => {
    const perTickFactor = 1 - (constants.massDecayRatePerSecond * decayMultiplier) / TICK_HZ;
    return constants.cellStartingMass + (mass - constants.cellStartingMass) * perTickFactor ** ticks;
  };
}

export const PLACED_KIND = { cell: 'cell', mote: 'mote', fragment: 'fragment' } as const;

export interface PlacedCell {
  readonly kind: typeof PLACED_KIND.cell;
  readonly playerIndex: number;
  readonly mass: number;
  readonly at: Vec2;
  /** The fixture restores the centre after the movement step every tick. */
  readonly isPinned: boolean;
  /** Fixture-granted trait ids bypass the ladder and the draft. */
  readonly traitIds: readonly string[];
}

export interface PlacedMote {
  readonly kind: typeof PLACED_KIND.mote;
  readonly moteKind: string;
  readonly variant: string | null;
  readonly at: Vec2;
}

export interface PlacedFragment {
  readonly kind: typeof PLACED_KIND.fragment;
  readonly tag: string;
  readonly at: Vec2;
}

export type PlacedFixture = PlacedCell | PlacedMote | PlacedFragment;

/** Where to put a fixture: an explicit point, or east of the first placed cell by a distance. */
export interface Placement {
  readonly at?: Vec2;
  readonly eastOfFirstCellWu?: number;
}

export interface PlaceCellOptions extends Placement {
  readonly playerIndex: number;
  readonly mass: number;
  readonly isPinned?: boolean;
  readonly traitIds?: readonly string[];
}

export interface PlaceMoteOptions extends Placement {
  readonly moteKind: string;
  readonly variant?: string;
}

export interface PlaceFragmentOptions extends Placement {
  readonly tag: string;
}

/**
 * Resolves the convention: the first placed cell sits at the broth point, anything else sits
 * east of that cell by the row's distance unless an explicit point is given.
 */
export function resolvePlacement(placement: Placement, firstCell: PlacedCell | undefined, what: string): Vec2 {
  if (placement.at !== undefined) {
    return placement.at;
  }
  if (placement.eastOfFirstCellWu !== undefined) {
    if (firstCell === undefined) {
      throw new ScenarioSetupError(`${what} is placed east of the first cell, but no cell has been placed yet`);
    }
    return { x: firstCell.at.x + placement.eastOfFirstCellWu, y: firstCell.at.y };
  }
  if (firstCell === undefined) {
    return BROTH_POINT;
  }
  throw new ScenarioSetupError(
    `${what} needs a placement: \`at\` or \`eastOfFirstCellWu\` (the row's centre distance)`,
  );
}

export function placeCell(options: PlaceCellOptions, firstCell: PlacedCell | undefined): PlacedCell {
  return {
    kind: PLACED_KIND.cell,
    playerIndex: options.playerIndex,
    mass: options.mass,
    at: resolvePlacement(options, firstCell, `player ${options.playerIndex}'s cell`),
    isPinned: options.isPinned ?? false,
    traitIds: options.traitIds ?? [],
  };
}

export function placeMote(options: PlaceMoteOptions, firstCell: PlacedCell | undefined): PlacedMote {
  return {
    kind: PLACED_KIND.mote,
    moteKind: options.moteKind,
    variant: options.variant ?? null,
    at: resolvePlacement(options, firstCell, `the ${options.moteKind} mote`),
  };
}

export function placeFragment(options: PlaceFragmentOptions, firstCell: PlacedCell | undefined): PlacedFragment {
  return {
    kind: PLACED_KIND.fragment,
    tag: options.tag,
    at: resolvePlacement(options, firstCell, `the ${options.tag} fragment`),
  };
}
