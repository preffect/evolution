// Where a fixture goes (docs/ECOLOGY.md §8). A placement is an anchor, not a point: the
// convention's named points resolve without a world, but "inside the cell", "10 wu east of the
// centre" and "at the centre of a gel patch" are only known once the world exists, so the
// record carries the relative form and the adapter resolves it in `applyFixture`.

import type { Vec2 } from '@evolution/shared';

export const ANCHOR_KIND = {
  point: 'point',
  broth: 'broth',
  vent: 'vent',
  shallows: 'shallows',
  gelPatchCentre: 'gel_patch_centre',
  insideCellOf: 'inside_cell_of',
  eastOfCellOf: 'east_of_cell_of',
} as const;

export interface PointAnchor {
  readonly kind: typeof ANCHOR_KIND.point;
  readonly at: Vec2;
}

/** One of the convention's named points: broth (1500, 0), the vent (origin) or the shallows. */
export interface ZoneAnchor {
  readonly kind: typeof ANCHOR_KIND.broth | typeof ANCHOR_KIND.vent | typeof ANCHOR_KIND.shallows;
}

/** The centre of the world's `patchIndex`-th seeded gel patch (E8). */
export interface GelPatchAnchor {
  readonly kind: typeof ANCHOR_KIND.gelPatchCentre;
  readonly patchIndex: number;
}

/** The centre of a player's cell, placed or seeded (E12, E15, P2: "inside the cell"). */
export interface InsideCellAnchor {
  readonly kind: typeof ANCHOR_KIND.insideCellOf;
  readonly playerIndex: number;
}

/** `distanceWu` east of a player's cell centre on the x axis (E4, E9: "centres 10 wu apart"). */
export interface EastOfCellAnchor {
  readonly kind: typeof ANCHOR_KIND.eastOfCellOf;
  readonly playerIndex: number;
  readonly distanceWu: number;
}

export type PlacementAnchor = PointAnchor | ZoneAnchor | GelPatchAnchor | InsideCellAnchor | EastOfCellAnchor;

/** Mid-broth, 1000 wu from both the vent and the shallows: no wall, vent or light effect reaches it. */
export const BROTH_POINT: Vec2 = { x: 1500, y: 0 };
/** "In the vent" = the origin. */
export const VENT_POINT: Vec2 = { x: 0, y: 0 };
/** "In the shallows" = (`DISH_RADIUS` − `SHALLOWS_WIDTH` / 2, 0). */
export function shallowsPoint(dishRadiusWu: number, shallowsWidthWu: number): Vec2 {
  return { x: dishRadiusWu - shallowsWidthWu / 2, y: 0 };
}

/** `placeCell({ ..., at: ZONE.vent })`: the convention's named zones. */
export const ZONE = {
  broth: { kind: ANCHOR_KIND.broth },
  vent: { kind: ANCHOR_KIND.vent },
  shallows: { kind: ANCHOR_KIND.shallows },
} as const satisfies Record<string, ZoneAnchor>;

export function atPoint(x: number, y: number): PointAnchor {
  return { kind: ANCHOR_KIND.point, at: { x, y } };
}

export function insideCellOf(playerIndex: number): InsideCellAnchor {
  return { kind: ANCHOR_KIND.insideCellOf, playerIndex };
}

export function eastOfCellOf(playerIndex: number, distanceWu: number): EastOfCellAnchor {
  return { kind: ANCHOR_KIND.eastOfCellOf, playerIndex, distanceWu };
}

export function gelPatchCentre(patchIndex: number): GelPatchAnchor {
  return { kind: ANCHOR_KIND.gelPatchCentre, patchIndex };
}

/** A bare `{ x, y }` in a placement option is a point anchor. */
export function toAnchor(placement: Vec2 | PlacementAnchor): PlacementAnchor {
  return 'kind' in placement ? placement : { kind: ANCHOR_KIND.point, at: placement };
}

/** The world dimensions the named zones depend on; the Evolution adapter reads them from its constants. */
export interface DishDimensions {
  readonly dishRadiusWu: number;
  readonly shallowsWidthWu: number;
}

/**
 * Resolves the anchors that need no world (a point or a named zone); `null` for the ones that
 * do, which the adapter resolves against its world (a cell centre, a gel patch).
 */
export function resolveFixedAnchor(anchor: PlacementAnchor, dish: DishDimensions): Vec2 | null {
  switch (anchor.kind) {
    case ANCHOR_KIND.point:
      return anchor.at;
    case ANCHOR_KIND.broth:
      return BROTH_POINT;
    case ANCHOR_KIND.vent:
      return VENT_POINT;
    case ANCHOR_KIND.shallows:
      return shallowsPoint(dish.dishRadiusWu, dish.shallowsWidthWu);
    default:
      return null;
  }
}

/** Renders an anchor for a setup error ("inside player 0's cell"). */
export function describeAnchor(anchor: PlacementAnchor): string {
  switch (anchor.kind) {
    case ANCHOR_KIND.point:
      return `(${anchor.at.x}, ${anchor.at.y})`;
    case ANCHOR_KIND.gelPatchCentre:
      return `the centre of gel patch ${anchor.patchIndex}`;
    case ANCHOR_KIND.insideCellOf:
      return `inside player ${anchor.playerIndex}'s cell`;
    case ANCHOR_KIND.eastOfCellOf:
      return `${anchor.distanceWu} wu east of player ${anchor.playerIndex}'s cell`;
    default:
      return `the ${anchor.kind}`;
  }
}
