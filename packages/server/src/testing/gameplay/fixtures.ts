// Fixture helpers the scenario tables share (docs/ecology/acceptance.md §8): the `decayed()` mass formula,
// the gel-patch clearance and the placed-entity records an adapter applies before tick 1 (or
// before a scheduled tick, docs/testing/scenario-runner.md §8.1). The literals here ARE the convention the design
// states; the balance numbers themselves are injected, because `constants/ecology.ts` and
// `constants/world.ts` land with #98 and this file must not grow a second copy of them.

import { TICK_HZ, type Vec2 } from '@evolution/shared';
import { ScenarioSetupError } from './errors.js';
import { eastOfCellOf, toAnchor, ZONE, type PlacementAnchor } from './placement.js';

/** A seeded gel patch this close to the broth point invalidates the seed for placed rows. */
export const GEL_PATCH_CLEARANCE_WU = 600;
/** The zone × trait decay multiplier when nothing modifies decay. */
export const DEFAULT_DECAY_MULTIPLIER = 1;
/** traits/model.md §2: every trait has tiers I, II and III; a fixture-granted trait is tier I unless the row says. */
export const FIRST_TRAIT_TIER = 1;
export const LAST_TRAIT_TIER = 3;

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

export const PLACED_KIND = { cell: 'cell', wildCell: 'wild_cell', mote: 'mote', fragment: 'fragment' } as const;

/** A fixture-granted trait at a tier (traits/model.md §2): bypasses the ladder and the draft. */
export interface PlacedTrait {
  readonly traitId: string;
  readonly tier: number;
}

export interface PlacedCell {
  readonly kind: typeof PLACED_KIND.cell;
  readonly playerIndex: number;
  readonly mass: number;
  readonly at: PlacementAnchor;
  /** The fixture restores the centre after the movement step every tick. */
  readonly isPinned: boolean;
  /** The traits the cell owns after placement: `[]` strips every trait (a placed cell at level 1 with none), `null` leaves its own. */
  readonly traits: readonly PlacedTrait[] | null;
  /** Fixture-set lifetime DNA ("level 12 with fixture DNA 1760", P7, P10); `null` leaves the cell's own. */
  readonly dnaCumulative: number | null;
  /** Fixture-set entry-rule gift inside that DNA (E9c: "140 with 100 gift"); `null` leaves the player's own. */
  readonly dnaCatchUpGift: number | null;
}

/**
 * Wild seat `seat`'s cell placed (or replaced) at `at` with its size factor set (docs/ecology/acceptance.md §8.1,
 * docs/testing/scenario-runner.md §8.1): the seat is cleared of target and velocity as a respawn does.
 */
export interface PlacedWildCell {
  readonly kind: typeof PLACED_KIND.wildCell;
  readonly seat: number;
  readonly sizeFactor: number;
  readonly at: PlacementAnchor;
}

export interface PlacedMote {
  readonly kind: typeof PLACED_KIND.mote;
  readonly moteKind: string;
  readonly variant: string | null;
  readonly at: PlacementAnchor;
}

export interface PlacedFragment {
  readonly kind: typeof PLACED_KIND.fragment;
  readonly tag: string;
  readonly at: PlacementAnchor;
}

export type PlacedFixture = PlacedCell | PlacedWildCell | PlacedMote | PlacedFragment;

/** Where to put a fixture: an anchor (or a bare point), or east of the first placed cell by a distance. */
export interface Placement {
  readonly at?: Vec2 | PlacementAnchor;
  readonly eastOfFirstCellWu?: number;
}

/** `'cilia'` is tier I; `{ traitId: 'nucleoid', tier: 2 }` names the tier. */
export type PlacedTraitOption = string | { readonly traitId: string; readonly tier?: number };

export interface PlaceCellOptions extends Placement {
  readonly playerIndex: number;
  readonly mass: number;
  readonly isPinned?: boolean;
  readonly traits?: readonly PlacedTraitOption[];
  readonly dnaCumulative?: number;
  readonly dnaCatchUpGift?: number;
}

/** "Seat 0 at size 1.0, placed 10 wu east of A" (W4): `placeWildCell({ seat: 0, sizeFactor: 1, eastOfFirstCellWu: 10 })`. */
export interface PlaceWildCellOptions extends Placement {
  readonly seat: number;
  readonly sizeFactor: number;
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
 * east of that cell by the row's distance unless an anchor is given.
 */
export function resolvePlacement(
  placement: Placement,
  firstCell: PlacedCell | undefined,
  what: string,
): PlacementAnchor {
  if (placement.at !== undefined) {
    return toAnchor(placement.at);
  }
  if (placement.eastOfFirstCellWu !== undefined) {
    if (firstCell === undefined) {
      throw new ScenarioSetupError(`${what} is placed east of the first cell, but no cell has been placed yet`);
    }
    return eastOfCellOf(firstCell.playerIndex, placement.eastOfFirstCellWu);
  }
  if (firstCell === undefined) {
    return ZONE.broth;
  }
  throw new ScenarioSetupError(
    `${what} needs a placement: \`at\` (an anchor or a point) or \`eastOfFirstCellWu\` (the row's centre distance)`,
  );
}

export function toPlacedTrait(option: PlacedTraitOption): PlacedTrait {
  const trait = typeof option === 'string' ? { traitId: option, tier: FIRST_TRAIT_TIER } : option;
  const tier = trait.tier ?? FIRST_TRAIT_TIER;
  if (!Number.isInteger(tier) || tier < FIRST_TRAIT_TIER || tier > LAST_TRAIT_TIER) {
    throw new ScenarioSetupError(
      `trait ${trait.traitId} has tiers ${FIRST_TRAIT_TIER} to ${LAST_TRAIT_TIER} (traits/model.md §2), got tier ${tier}`,
    );
  }
  return { traitId: trait.traitId, tier };
}

export function placeCell(options: PlaceCellOptions, firstCell: PlacedCell | undefined): PlacedCell {
  return {
    kind: PLACED_KIND.cell,
    playerIndex: options.playerIndex,
    mass: options.mass,
    at: resolvePlacement(options, firstCell, `player ${options.playerIndex}'s cell`),
    isPinned: options.isPinned ?? false,
    traits: options.traits === undefined ? null : options.traits.map(toPlacedTrait),
    dnaCumulative: options.dnaCumulative ?? null,
    dnaCatchUpGift: options.dnaCatchUpGift ?? null,
  };
}

export function placeWildCell(options: PlaceWildCellOptions, firstCell: PlacedCell | undefined): PlacedWildCell {
  if (!Number.isInteger(options.seat) || options.seat < 0) {
    throw new ScenarioSetupError(`a wild seat is a whole number from 0, got ${options.seat}`);
  }
  if (!(options.sizeFactor > 0)) {
    throw new ScenarioSetupError(`a wild seat's size factor is positive, got ${options.sizeFactor}`);
  }
  return {
    kind: PLACED_KIND.wildCell,
    seat: options.seat,
    sizeFactor: options.sizeFactor,
    at: resolvePlacement(options, firstCell, `wild seat ${options.seat}'s cell`),
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
