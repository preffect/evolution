// The slime's world-stable scatters, made once a page (docs/rendering/opening-dive.md §4, ticket #803): the mockup's
// `forCells` grids for the slime's clouds, the floor's diatoms, the bacteria and the food specks, each cell's roll
// ported bit for bit (`coordinateHash`), kept where the mockup kept it and out where it can never show. Each instance
// is a quad the GPU lays every frame: its size, level of detail and drift are worked out in the vertex shader. Tens of
// thousands of cells, so each grid is made a column a step on the dive's bake pump (`slime-bakes.ts`).

import { KELP_DROP } from '../../constants/dive-kelp-drop';
import {
  SLIME_CLOUDS,
  SLIME_FLOOR_DIATOMS,
  SLIME_POCKET_RADIUS_M,
  SLIME_SCATTER_REACH_M,
} from '../../constants/dive-slime';
import { SLIME_MOTES, SLIME_RODS } from '../../constants/dive-slime-bacteria';
import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { coordinateHash } from '../shore/shore-noise';

/** One cell of a grid: its column and row, its place in metres and its two rolls (`forCells`' `fn` arguments). */
export interface ScatterCell {
  readonly column: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  readonly first: number;
  readonly second: number;
}

/** A box in metres round the focus. */
interface ScatterBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The hash salts after a grid's own (`hash(i, j, k + 1 … 3)`): its y, and its two rolls. */
const SALT_Y = 1;
const SALT_FIRST = 2;
const SALT_SECOND = 3;

/** The cell at a column and row of the `cellM` grid salted `salt`. */
export function scatterCell(cellM: number, salt: number, column: number, row: number): ScatterCell {
  return {
    column,
    row,
    x: (column + coordinateHash(column, row, salt)) * cellM,
    y: (row + coordinateHash(column, row, salt + SALT_Y)) * cellM,
    first: coordinateHash(column, row, salt + SALT_FIRST),
    second: coordinateHash(column, row, salt + SALT_SECOND),
  };
}

/**
 * What `make` keeps of each cell of the `cellM` grid salted `salt` whose column and row lie over `box`, column by
 * column, a column a step.
 */
export function* scatter<T>(
  grid: { readonly cellM: number; readonly salt: number },
  box: ScatterBox,
  make: (cell: ScatterCell) => T | null,
): Generator<void, T[]> {
  const kept: T[] = [];
  const { cellM, salt } = grid;
  const lastColumn = Math.floor(box.right / cellM);
  const lastRow = Math.floor(box.bottom / cellM);
  for (let column = Math.floor(box.left / cellM); column <= lastColumn; column += 1) {
    for (let row = Math.floor(box.top / cellM); row <= lastRow; row += 1) {
      const made = make(scatterCell(cellM, salt, column, row));
      if (made !== null) kept.push(made);
    }
    yield;
  }
  return kept;
}

function squareBox(reachM: number): ScatterBox {
  return { left: -reachM, top: -reachM, right: reachM, bottom: reachM };
}

function dropBox(marginM: number): ScatterBox {
  const reach = KELP_DROP.radiusM + marginM;
  return {
    left: KELP_DROP.x - reach,
    top: KELP_DROP.y - reach,
    right: KELP_DROP.x + reach,
    bottom: KELP_DROP.y + reach,
  };
}

function distanceToDrop(x: number, y: number): number {
  return Math.hypot(x - KELP_DROP.x, y - KELP_DROP.y);
}

/** A slime cloud: its place, radius and own alpha (`drawSlime`). */
export interface SlimeCloud {
  readonly x: number;
  readonly y: number;
  readonly radiusM: number;
  readonly alpha: number;
}

/** The clouds: none in the dish, none that could not reach the drop, none past the widest view under their cap. */
export function slimeClouds(): Generator<void, SlimeCloud[]> {
  const { clearRadii, radiusM, alpha } = SLIME_CLOUDS;
  const reach = radiusM.min + radiusM.span;
  const inDrop = dropBox(reach);
  const inView = squareBox(SLIME_SCATTER_REACH_M.clouds);
  const box = {
    left: Math.max(inDrop.left, inView.left),
    top: Math.max(inDrop.top, inView.top),
    right: Math.min(inDrop.right, inView.right),
    bottom: Math.min(inDrop.bottom, inView.bottom),
  };
  return scatter(SLIME_CLOUDS, box, (cell) => {
    const isKept =
      Math.hypot(cell.x, cell.y) >= SLIME_POCKET_RADIUS_M * clearRadii &&
      distanceToDrop(cell.x, cell.y) < KELP_DROP.radiusM + reach;
    if (!isKept) return null;
    return {
      x: cell.x,
      y: cell.y,
      radiusM: radiusM.min + cell.second * radiusM.span,
      alpha: alpha.min + cell.first * alpha.span,
    };
  });
}

/** A floor diatom: its place, length, heading and kind (`drawFloorDiatoms`). */
export interface FloorDiatom {
  readonly x: number;
  readonly y: number;
  readonly lengthM: number;
  readonly angle: number;
  readonly kind: number;
}

/** The kind a roll picks: the first of the rolls' bounds it is under, or the last kind (`k < .45 ? 0 : k < .8 ? 1 : 2`). */
export function kindOfRoll(roll: number, bounds: readonly number[]): number {
  const kind = bounds.findIndex((bound) => roll < bound);
  return kind === -1 ? bounds.length : kind;
}

/** Whether the mockup kept the floor diatom of `cell`: inside the drop (outside it one never shows), clear of the dish. */
function isDiatomKept(cell: ScatterCell): boolean {
  const look = SLIME_FLOOR_DIATOMS;
  return (
    Math.hypot(cell.x, cell.y) >= look.clearOfFocusM &&
    coordinateHash(cell.column, cell.row, look.keepSalt) <= look.keepAtOrBelow &&
    distanceToDrop(cell.x, cell.y) <= KELP_DROP.radiusM
  );
}

/** The floor's diatoms. */
export function floorDiatoms(): Generator<void, FloorDiatom[]> {
  const look = SLIME_FLOOR_DIATOMS;
  return scatter(look, dropBox(0), (cell) =>
    isDiatomKept(cell)
      ? {
          x: cell.x,
          y: cell.y,
          lengthM: look.lengthM.min + cell.first * look.lengthM.span,
          angle: cell.second * RADIANS_PER_FULL_TURN,
          kind: kindOfRoll(coordinateHash(cell.column, cell.row, look.kindSalt), look.kindRolls),
        }
      : null,
  );
}

/** A rod: its place, size, heading, drift phase, kind and whether it is in the dish (`drawBacteria`). */
export interface SlimeRod {
  readonly x: number;
  readonly y: number;
  readonly lengthM: number;
  readonly widthM: number;
  readonly angle: number;
  readonly phase: number;
  readonly kind: number;
  readonly isInDish: boolean;
}

function isRodKept(cell: ScatterCell): boolean {
  const look = SLIME_RODS;
  const distance = Math.hypot(cell.x, cell.y);
  const isInDish = distance < SLIME_POCKET_RADIUS_M * look.inDishRadii;
  if (distance < look.clearOfFocusM || (!isInDish && distance < SLIME_POCKET_RADIUS_M * look.clearOfWallRadii)) {
    return false;
  }
  return coordinateHash(cell.column, cell.row, look.keepSalt) <= (isInDish ? look.keep.inDish : look.keep.slime);
}

/** The bacteria, out as far as the widest view under their cap. */
export function slimeRods(): Generator<void, SlimeRod[]> {
  const look = SLIME_RODS;
  return scatter(look, squareBox(SLIME_SCATTER_REACH_M.rods), (cell) => {
    if (!isRodKept(cell)) return null;
    const isInDish = Math.hypot(cell.x, cell.y) < SLIME_POCKET_RADIUS_M * look.inDishRadii;
    return {
      x: cell.x,
      y: cell.y,
      lengthM: look.lengthM.min + cell.first * look.lengthM.span,
      widthM: look.widthM.min + coordinateHash(cell.column, cell.row, look.widthM.salt) * look.widthM.span,
      angle: coordinateHash(cell.column, cell.row, look.angleSalt) * RADIANS_PER_FULL_TURN,
      phase: cell.column * look.phase.column + cell.row * look.phase.row,
      kind: kindOfRoll(cell.second, isInDish ? look.kindRolls.inDish : look.kindRolls.slime),
      isInDish,
    };
  });
}

/** A food speck: its place, radius, whether it is a lipid, its drift's column and row, whether it is in the dish. */
export interface SlimeMote {
  readonly x: number;
  readonly y: number;
  readonly radiusM: number;
  readonly isLipid: boolean;
  readonly column: number;
  readonly row: number;
  readonly isInDish: boolean;
}

/** The food specks round the dish (`drawBacteria`'s motes). */
export function slimeMotes(): Generator<void, SlimeMote[]> {
  const look = SLIME_MOTES;
  const reach = SLIME_POCKET_RADIUS_M * look.reachRadii;
  return scatter(look, squareBox(reach), (cell) => {
    const distance = Math.hypot(cell.x, cell.y);
    const isInDish = distance < SLIME_POCKET_RADIUS_M;
    const isKept = distance >= look.clearOfFocusM && distance <= reach;
    if (!isKept || cell.first > (isInDish ? look.keep.inDish : look.keep.slime)) return null;
    return {
      x: cell.x,
      y: cell.y,
      radiusM: look.radiusM.min + cell.second * look.radiusM.span,
      isLipid: cell.first < look.lipidBelow,
      column: cell.column,
      row: cell.row,
      isInDish,
    };
  });
}

/** The scatters the quads are made from. */
export interface SlimeScatters {
  readonly clouds: readonly SlimeCloud[];
  readonly diatoms: readonly FloorDiatom[];
  readonly rods: readonly SlimeRod[];
  readonly motes: readonly SlimeMote[];
}

/** Every scatter, a column a step. */
export function* bakeSlimeScatters(): Generator<void, SlimeScatters> {
  const clouds = yield* slimeClouds();
  const diatoms = yield* floorDiatoms();
  const rods = yield* slimeRods();
  const motes = yield* slimeMotes();
  return { clouds, diatoms, rods, motes };
}
