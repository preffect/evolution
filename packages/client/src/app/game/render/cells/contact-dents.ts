// The contact dent (docs/VISUAL-STYLE.md §5, docs/RENDERING.md §2.1): a −12 % dimple toward a
// touching neighbour while the separation rule of ECOLOGY §5.3 applies, so never between a
// predator and its prey. A visible-cell scan, one dent per cell (the deepest overlap wins); the
// σ is the cell's own (22°, 14° with `cytoskeleton`), the amplitude grows with the press (0 at
// first touch, full at `CONTACT_DENT_FULL_OVERLAP_RADII` of the smaller radius, so the server's
// exponential separation eases it out), and an engulfing cell drops the dent because the arm
// already dents its membrane (§2.1's slot rule).

import type { CellView, EntityId } from '@evolution/shared';
import {
  CONTACT_DENT_AMPLITUDE,
  CONTACT_DENT_FULL_OVERLAP_RADII,
  CONTACT_DENT_SIGMA_DEG,
  CONTACT_DENT_TAUT_SIGMA_DEG,
} from '../constants';
import { clamp01, degreesToRadians } from '../geometry';
import type { CellDeformation } from './cell-deformation';
import type { ShapeBump } from './radial-profile';

export type ContactCell = Pick<CellView, 'id' | 'x' | 'y' | 'radius' | 'engulfingCellId' | 'engulfedByCellId'>;

export interface ContactDent {
  /** World units the two discs overlap. */
  readonly overlap: number;
  /** The angle toward the neighbour, cell frame. */
  readonly angle: number;
  /** 0 at first touch → 1 at the full-amplitude overlap (`CONTACT_DENT_FULL_OVERLAP_RADII` × the smaller radius). */
  readonly depth: number;
}

export type ContactDents = ReadonlyMap<EntityId, ContactDent>;

export const NO_CONTACT_DENTS: ContactDents = new Map();

const CONTACT_SIGMA = degreesToRadians(CONTACT_DENT_SIGMA_DEG);
const TAUT_SIGMA = degreesToRadians(CONTACT_DENT_TAUT_SIGMA_DEG);

function isEngulfPair(first: ContactCell, second: ContactCell): boolean {
  return (
    first.engulfingCellId === second.id ||
    second.engulfingCellId === first.id ||
    first.engulfedByCellId === second.id ||
    second.engulfedByCellId === first.id
  );
}

function keepDeeper(dents: Map<EntityId, ContactDent>, id: EntityId, candidate: ContactDent): void {
  const current = dents.get(id);
  if (current === undefined || candidate.overlap > current.overlap) dents.set(id, candidate);
}

/** The deepest touching neighbour of every cell in `cells`, keyed by cell id; engulf pairs never touch. No allocation per pair. */
export function computeContactDents(cells: readonly ContactCell[]): ContactDents {
  const dents = new Map<EntityId, ContactDent>();
  for (let firstIndex = 0; firstIndex < cells.length; firstIndex += 1) {
    const first = cells[firstIndex];
    if (first === undefined) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < cells.length; secondIndex += 1) {
      const second = cells[secondIndex];
      if (second === undefined) continue;
      const deltaX = second.x - first.x;
      const deltaY = second.y - first.y;
      const distance = Math.hypot(deltaX, deltaY);
      const overlap = first.radius + second.radius - distance;
      if (overlap <= 0 || distance === 0 || isEngulfPair(first, second)) continue;
      const angle = Math.atan2(deltaY, deltaX);
      const depth = clamp01(overlap / (CONTACT_DENT_FULL_OVERLAP_RADII * Math.min(first.radius, second.radius)));
      keepDeeper(dents, first.id, { overlap, angle, depth });
      keepDeeper(dents, second.id, { overlap, angle: angle + Math.PI, depth });
    }
  }
  return dents;
}

/** The dent as a profile bump: −12 % r × depth toward the neighbour, σ 22° (14° when taut). */
export function contactDentBump(dent: ContactDent, isTaut: boolean): ShapeBump {
  return {
    amplitude: CONTACT_DENT_AMPLITUDE * dent.depth,
    centre: dent.angle,
    sigma: isTaut ? TAUT_SIGMA : CONTACT_SIGMA,
  };
}

/** `deformation` with the cell's dent appended, unless it is engulfing (the arm dents instead). */
export function withContactDent(
  deformation: CellDeformation,
  dent: ContactDent | undefined,
  options: { readonly isTaut: boolean; readonly isEngulfing: boolean },
): CellDeformation {
  if (dent === undefined || options.isEngulfing) return deformation;
  return { ...deformation, bumps: [...deformation.bumps, contactDentBump(dent, options.isTaut)] };
}
