// The contact dent (docs/VISUAL-STYLE.md §5): a −12 % dimple toward a touching neighbour while the
// separation rule of ECOLOGY §5.3 applies, so never between a predator and its prey. A visible-cell
// scan, one dent per cell (the deepest overlap wins); σ is applied by shape-terms per the cell's traits.

import type { CellView, EntityId } from '@evolution/shared';
import { CONTACT_DENT_AMPLITUDE } from '../constants';
import type { ShapeBump } from './radial-profile';

type ContactCell = Pick<CellView, 'id' | 'x' | 'y' | 'radius' | 'engulfingCellId' | 'engulfedByCellId'>;

interface Candidate {
  readonly overlap: number;
  readonly angle: number;
}

function isEngulfPair(first: ContactCell, second: ContactCell): boolean {
  return (
    first.engulfingCellId === second.id ||
    second.engulfingCellId === first.id ||
    first.engulfedByCellId === second.id ||
    second.engulfedByCellId === first.id
  );
}

function keepDeeper(map: Map<EntityId, Candidate>, id: EntityId, candidate: Candidate): void {
  const current = map.get(id);
  if (!current || candidate.overlap > current.overlap) map.set(id, candidate);
}

/** One dent per touching cell, keyed by id; `sigma` is a placeholder the caller replaces per traits. */
export function computeContactDents(cells: readonly ContactCell[]): Map<EntityId, ShapeBump> {
  const candidates = new Map<EntityId, Candidate>();
  for (let firstIndex = 0; firstIndex < cells.length; firstIndex += 1) {
    const first = cells[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < cells.length; secondIndex += 1) {
      const second = cells[secondIndex]!;
      const deltaX = second.x - first.x;
      const deltaY = second.y - first.y;
      const distance = Math.hypot(deltaX, deltaY);
      const overlap = first.radius + second.radius - distance;
      if (overlap <= 0 || distance === 0 || isEngulfPair(first, second)) continue;
      const angle = Math.atan2(deltaY, deltaX);
      keepDeeper(candidates, first.id, { overlap, angle });
      keepDeeper(candidates, second.id, { overlap, angle: angle + Math.PI });
    }
  }
  const dents = new Map<EntityId, ShapeBump>();
  for (const [id, candidate] of candidates) {
    dents.set(id, { amplitude: CONTACT_DENT_AMPLITUDE, centre: candidate.angle, sigma: 1 });
  }
  return dents;
}
