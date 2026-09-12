// Organelle rest slots (docs/RENDERING.md §3): normalised, heading-independent positions in the
// cell frame drawn from the cell's cosmetic fork. The nucleus (or the nucleoid) sits 0.12 r toward
// the light; every other organelle is rejection-sampled in the annulus between the DNA ring
// keep-out and the membrane margin, outside the nucleus disc (measured from the nucleus centre)
// and clear of every other slot, kept ones of later kinds included. Slots are appended, never
// reshuffled, so a tier-up adds a bean without moving the rest.

import { RADIANS_PER_FULL_TURN, lerp, type RandomSource } from '@evolution/shared';
import {
  CHLOROPLAST,
  DNA_RING_KEEP_OUT_FRACTION,
  FOOD_VACUOLE,
  LIPID_DROPLET,
  MITOCHONDRION,
  NUCLEOID_RADIUS,
  NUCLEUS_RADIUS,
  ORGANELLE_KIND,
  ORGANELLE_MEMBRANE_MARGIN,
  ORGANELLE_MIN_GAP,
  ORGANELLE_SLOT_MAX_ATTEMPTS,
  PROTOCELL_GRANULE_RADIUS_MAX,
  TOXIN_VACUOLE,
  type OrganelleKind,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { NUCLEUS_REST_OFFSET } from '../light-direction';
import type { CellTraitSummary } from './cell-traits';
import { NUCLEUS_KINDS, ORGANELLE_KIND_ORDER, organelleCounts } from './organelle-kinds';

export interface OrganelleSlot {
  readonly kind: OrganelleKind;
  /** Rest position, cell frame, fraction of `r`. */
  readonly x: number;
  readonly y: number;
  /** The sprite body's diameter as a fraction of `r`, for the gap rule. */
  readonly size: number;
  /** A phase in turns for the sprite's own motion. */
  readonly phase: number;
  readonly index: number;
}

interface Candidate {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/** Sprite body diameters in `r` per kind (docs/VISUAL-STYLE.md §4, sheet 01). */
const SLOT_SIZE: Readonly<Record<OrganelleKind, number>> = {
  [ORGANELLE_KIND.nucleus]: NUCLEUS_RADIUS * DIAMETER_PER_RADIUS,
  [ORGANELLE_KIND.nucleoid]: NUCLEOID_RADIUS * DIAMETER_PER_RADIUS,
  [ORGANELLE_KIND.mitochondrion]: MITOCHONDRION.length,
  [ORGANELLE_KIND.chloroplast]: CHLOROPLAST.radius * DIAMETER_PER_RADIUS,
  [ORGANELLE_KIND.foodVacuole]: FOOD_VACUOLE.radius * DIAMETER_PER_RADIUS,
  [ORGANELLE_KIND.toxinVacuole]: TOXIN_VACUOLE.radius * DIAMETER_PER_RADIUS,
  [ORGANELLE_KIND.lipid]: LIPID_DROPLET.radiusMax * DIAMETER_PER_RADIUS,
  [ORGANELLE_KIND.protocellGranule]: PROTOCELL_GRANULE_RADIUS_MAX * DIAMETER_PER_RADIUS,
};

/** The sub-stream label of one slot: the cell's seed, the kind and the index, never the time it was added. */
function slotLabel(kind: OrganelleKind, index: number): string {
  return `slot:${kind}:${index}`;
}

function nucleusSlot(kind: OrganelleKind, random: RandomSource): OrganelleSlot {
  return {
    kind,
    x: NUCLEUS_REST_OFFSET.x,
    y: NUCLEUS_REST_OFFSET.y,
    size: SLOT_SIZE[kind],
    phase: random.nextFloat(),
    index: 0,
  };
}

/** The nucleus disc's reach from its own centre: the larger of the nucleus and the nucleoid (VISUAL-STYLE §3). */
const NUCLEUS_DISC_RADIUS = Math.max(NUCLEUS_RADIUS, NUCLEOID_RADIUS);

/**
 * The smallest edge-to-edge gap between a candidate and the placed organelle sprites; a candidate
 * whose centre falls inside the nucleus disc (measured from the nucleus slot, which sits off-centre)
 * is out of bounds, whatever the sprites say.
 */
function smallestGap(candidate: Candidate, placed: readonly OrganelleSlot[]): number {
  let smallest = Number.POSITIVE_INFINITY;
  for (const other of placed) {
    if (NUCLEUS_KINDS.has(other.kind)) {
      if (Math.hypot(candidate.x - other.x, candidate.y - other.y) < NUCLEUS_DISC_RADIUS)
        return Number.NEGATIVE_INFINITY;
      continue;
    }
    const gap = Math.hypot(candidate.x - other.x, candidate.y - other.y) - candidate.size * HALF - other.size * HALF;
    smallest = Math.min(smallest, gap);
  }
  return smallest;
}

/**
 * Rejection sampling of the slot centre in the annulus (docs/VISUAL-STYLE.md §3: centres never
 * inside the keep-out, the nucleus disc or the membrane margin); the first draw clear of every
 * placed sprite wins, else the best of the attempts, so a slot always exists.
 */
function sampledSlot(
  kind: OrganelleKind,
  index: number,
  random: RandomSource,
  placed: readonly OrganelleSlot[],
): OrganelleSlot {
  const size = SLOT_SIZE[kind];
  const innerRadius = DNA_RING_KEEP_OUT_FRACTION;
  const outerRadius = 1 - ORGANELLE_MEMBRANE_MARGIN;
  let best: Candidate = { x: innerRadius, y: 0, size };
  let bestGap = Number.NEGATIVE_INFINITY;
  for (let attempt = 0; attempt < ORGANELLE_SLOT_MAX_ATTEMPTS && bestGap < ORGANELLE_MIN_GAP; attempt += 1) {
    const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const distance = lerp(innerRadius, outerRadius, Math.sqrt(random.nextFloat()));
    const candidate = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size };
    const gap = smallestGap(candidate, placed);
    if (gap > bestGap) {
      best = candidate;
      bestGap = gap;
    }
  }
  return { kind, ...best, phase: random.nextFloat(), index };
}

/**
 * The slots for `traits`, keeping every slot of `previous` that is still wanted (append-only) and
 * drawing the new ones from `cosmetic.fork('slot:<kind>:<index>')`, so a slot depends only on the
 * cell's seed, its kind and its index, never on when it was added. A new slot is gap-checked
 * against every kept slot, the later-order ones included, so a tier-up never lands a bean on one.
 */
export function layoutOrganelles(
  traits: CellTraitSummary,
  cosmetic: RandomSource,
  previous: readonly OrganelleSlot[] = [],
): OrganelleSlot[] {
  const wanted = organelleCounts(traits);
  const kept = previous.filter((slot) => slot.index < wanted[slot.kind]);
  const slots: OrganelleSlot[] = [];
  for (const kind of ORGANELLE_KIND_ORDER) {
    for (let index = 0; index < wanted[kind]; index += 1) {
      const existing = kept.find((slot) => slot.kind === kind && slot.index === index);
      if (existing !== undefined) {
        slots.push(existing);
        continue;
      }
      const random = cosmetic.fork(slotLabel(kind, index));
      const placed = [...slots, ...kept.filter((slot) => !slots.includes(slot))];
      slots.push(NUCLEUS_KINDS.has(kind) ? nucleusSlot(kind, random) : sampledSlot(kind, index, random, placed));
    }
  }
  return slots;
}
