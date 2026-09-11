// Organelle rest slots (docs/RENDERING.md §3): normalised, heading-independent positions in the
// cell frame drawn from the cell's cosmetic fork. The nucleus (or the nucleoid) sits 0.12 r toward
// the light; every other organelle is rejection-sampled in the annulus between the DNA ring
// keep-out and the membrane margin, outside the nucleus disc and clear of the other slots. Slots
// are appended, never reshuffled, so a tier-up adds a bean without moving the rest.

import { RADIANS_PER_FULL_TURN, type RandomSource } from '@evolution/shared';
import {
  CHLOROPLAST,
  DNA_RING_KEEP_OUT_FRACTION,
  FOOD_VACUOLE,
  LIGHT_DIRECTION_DEG,
  LIPID_DROPLET,
  MITOCHONDRION,
  NUCLEOID_RADIUS,
  NUCLEUS_OFFSET_TOWARD_LIGHT,
  NUCLEUS_RADIUS,
  ORGANELLE_MEMBRANE_MARGIN,
  ORGANELLE_MIN_GAP,
  ORGANELLE_SLOT_MAX_ATTEMPTS,
  PROTOCELL_GRANULE_RADIUS_MAX,
  TOXIN_VACUOLE,
} from '../constants';
import { degreesToRadians, lerp } from '../geometry';
import {
  NUCLEUS_KINDS,
  ORGANELLE_KIND,
  ORGANELLE_KIND_ORDER,
  organelleCounts,
  type OrganelleKind,
} from './organelle-kinds';
import type { CellTraitSummary } from './cell-traits';

export interface OrganelleSlot {
  readonly kind: OrganelleKind;
  /** Rest position, cell frame, fraction of `r`. */
  readonly x: number;
  readonly y: number;
  /** The sprite's diameter as a fraction of `r`. */
  readonly size: number;
  /** A phase in turns for the sprite's own motion. */
  readonly phase: number;
  readonly index: number;
}

/** Slot sizes are diameters; the constants are radii. */
const DIAMETER = 2;

/** Sprite diameters in `r` per kind (docs/VISUAL-STYLE.md §4, sheet 01). */
const SLOT_SIZE: Readonly<Record<OrganelleKind, number>> = {
  [ORGANELLE_KIND.nucleus]: NUCLEUS_RADIUS * DIAMETER,
  [ORGANELLE_KIND.nucleoid]: NUCLEOID_RADIUS * DIAMETER,
  [ORGANELLE_KIND.mitochondrion]: MITOCHONDRION.length,
  [ORGANELLE_KIND.chloroplast]: CHLOROPLAST.radius * DIAMETER,
  [ORGANELLE_KIND.foodVacuole]: FOOD_VACUOLE.radius * DIAMETER,
  [ORGANELLE_KIND.toxinVacuole]: TOXIN_VACUOLE.radius * DIAMETER,
  [ORGANELLE_KIND.lipid]: LIPID_DROPLET.radiusMax * DIAMETER,
  [ORGANELLE_KIND.protocellGranule]: PROTOCELL_GRANULE_RADIUS_MAX * DIAMETER,
};

const HALF = 0.5;

function slotLabel(kind: OrganelleKind, index: number): string {
  return `slot:${kind}:${index}`;
}

function nucleusSlot(kind: OrganelleKind, random: RandomSource): OrganelleSlot {
  const angle = degreesToRadians(LIGHT_DIRECTION_DEG);
  return {
    kind,
    x: Math.cos(angle) * NUCLEUS_OFFSET_TOWARD_LIGHT,
    y: Math.sin(angle) * NUCLEUS_OFFSET_TOWARD_LIGHT,
    size: SLOT_SIZE[kind],
    phase: random.nextFloat(),
    index: 0,
  };
}

/** The smallest edge-to-edge gap between a candidate and the placed organelle sprites (the nucleus is not a sprite here). */
function smallestGap(candidate: { x: number; y: number; size: number }, placed: readonly OrganelleSlot[]): number {
  let smallest = Number.POSITIVE_INFINITY;
  for (const other of placed) {
    if (NUCLEUS_KINDS.has(other.kind)) continue;
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
  const innerRadius = Math.max(DNA_RING_KEEP_OUT_FRACTION, NUCLEUS_RADIUS);
  const outerRadius = 1 - ORGANELLE_MEMBRANE_MARGIN;
  let best = { x: innerRadius, y: 0, size };
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
 * cell's seed, its kind and its index, never on when it was added.
 */
export function layoutOrganelles(
  traits: CellTraitSummary,
  cosmetic: RandomSource,
  previous: readonly OrganelleSlot[] = [],
): OrganelleSlot[] {
  const wanted = organelleCounts(traits);
  const slots: OrganelleSlot[] = [];
  for (const kind of ORGANELLE_KIND_ORDER) {
    const count = wanted[kind];
    for (let index = 0; index < count; index += 1) {
      const kept = previous.find((slot) => slot.kind === kind && slot.index === index);
      if (kept !== undefined) {
        slots.push(kept);
        continue;
      }
      const random = cosmetic.fork(slotLabel(kind, index));
      slots.push(NUCLEUS_KINDS.has(kind) ? nucleusSlot(kind, random) : sampledSlot(kind, index, random, slots));
    }
  }
  return slots;
}
