// The ladder orbit's layout (docs/UI.md §3.1.2–§3.1.3, docs/RENDERING.md §10): where the rung ghost,
// each counter's ghost and pip block, and the callout backings under them sit on the orbit of the own
// cell at `r_px`, as angles and px offsets from its centre. A counter is centred on its §9 angle,
// ghost first and pips after, clockwise; beside a rung ghost it turns away just far enough to stay
// clear (decision #285 B); backings whose pads meet merge into one band. Pure.

import { clamp, type BacteriumVariant, type TraitId } from '@evolution/shared';
import {
  LADDER_BACKING_END_PAD_PX,
  LADDER_GHOST_PX,
  LADDER_ITEM_CLEARANCE_PX,
  LADDER_ITEM_GAP_PX,
  LADDER_PIP_GAP_PX,
  LADDER_PIP_PX,
  LADDER_PIP_ROW_MAX,
} from '../constants';
import { HALF } from '../geometry';
import type { Ladder, LadderCounter, LadderGhost, LadderSilhouette } from '../../state/own-cell-indicators';
import { ladderOrbitRadiusPx, orbitDegreesOf, orbitPointPx, type OrbitPoint } from './own-cell-indicators';

const NO_PIPS = 0;

/** A stretch of the orbit, clockwise from `startDeg` to `endDeg` (degrees from 12 o'clock). */
export interface OrbitArc {
  readonly startDeg: number;
  readonly endDeg: number;
}

export interface OrbitGhost extends OrbitPoint {
  /** The silhouette of the next rung, or the endosymbiont a counter's ghost shows. */
  readonly key: LadderSilhouette | TraitId;
  /** A full counter's level-gold ring (`LadderCounter.isUnlocked`); never on a rung ghost. */
  readonly hasUnlockRing: boolean;
}

export interface OrbitPipBlock extends OrbitPoint {
  readonly variant: BacteriumVariant;
  /** Clamped to `required` again here: the pip atlas has no entry past it (UI.md §3.1.2). */
  readonly eaten: number;
  readonly required: number;
}

export interface OrbitLayout {
  readonly radiusPx: number;
  /** One arc per orbit item group (a rung ghost, or a counter's ghost and pips), unpadded. */
  readonly spans: readonly OrbitArc[];
  /** The callout backings: each span padded by `LADDER_BACKING_END_PAD_PX`, merged where two meet. */
  readonly backings: readonly OrbitArc[];
  readonly ghosts: readonly OrbitGhost[];
  readonly pipBlocks: readonly OrbitPipBlock[];
}

function pipRunPx(count: number): number {
  return count <= NO_PIPS ? 0 : count * LADDER_PIP_PX + (count - 1) * LADDER_PIP_GAP_PX;
}

/** The pip block: `required` pips in rows of `LADDER_PIP_ROW_MAX`, width along the tangent. */
export function pipBlockSizePx(required: number): { readonly width: number; readonly height: number } {
  return {
    width: pipRunPx(Math.min(required, LADDER_PIP_ROW_MAX)),
    height: pipRunPx(Math.ceil(required / LADDER_PIP_ROW_MAX)),
  };
}

/** A counter along the orbit: its ghost, the item gap, then its pip block. */
export function counterLengthPx(required: number): number {
  return LADDER_GHOST_PX + LADDER_ITEM_GAP_PX + pipBlockSizePx(required).width;
}

interface OrbitGroup {
  readonly span: OrbitArc;
  readonly ghosts: readonly OrbitGhost[];
  readonly pipBlocks: readonly OrbitPipBlock[];
}

function rungGhostGroup(ghost: LadderGhost, radiusPx: number): OrbitGroup {
  const halfDeg = orbitDegreesOf(LADDER_GHOST_PX * HALF, radiusPx);
  return {
    span: { startDeg: ghost.angleDeg - halfDeg, endDeg: ghost.angleDeg + halfDeg },
    ghosts: [{ ...orbitPointPx(radiusPx, ghost.angleDeg), key: ghost.silhouette, hasUnlockRing: false }],
    pipBlocks: [],
  };
}

/**
 * Where a counter is centred: on its own angle, unless a rung ghost shares the orbit and the counter
 * would come nearer to it than `LADDER_ITEM_CLEARANCE_PX` (decision #285 B at small sizes). Then the
 * ghost keeps its angle and the counter turns away from it just far enough: clockwise when it sits
 * clockwise of the ghost (aerobic, 225), counter-clockwise when it sits before it (photosynthetic, 135).
 */
function counterCentreDeg(counter: LadderCounter, ghostSpan: OrbitArc | null, radiusPx: number): number {
  if (ghostSpan === null) return counter.angleDeg;
  const reachDeg = orbitDegreesOf(counterLengthPx(counter.required) * HALF + LADDER_ITEM_CLEARANCE_PX, radiusPx);
  const ghostCentreDeg = (ghostSpan.startDeg + ghostSpan.endDeg) * HALF;
  return counter.angleDeg >= ghostCentreDeg
    ? Math.max(counter.angleDeg, ghostSpan.endDeg + reachDeg)
    : Math.min(counter.angleDeg, ghostSpan.startDeg - reachDeg);
}

/** Centred on `centreDeg`, ghost first, clockwise; a hidden ghost keeps its place so the pips stay. */
function counterGroup(counter: LadderCounter, centreDeg: number, radiusPx: number): OrbitGroup {
  const lengthPx = counterLengthPx(counter.required);
  const startDeg = centreDeg - orbitDegreesOf(lengthPx * HALF, radiusPx);
  const pointAlong = (alongPx: number): OrbitPoint =>
    orbitPointPx(radiusPx, startDeg + orbitDegreesOf(alongPx, radiusPx));
  const blockCentrePx = LADDER_GHOST_PX + LADDER_ITEM_GAP_PX + pipBlockSizePx(counter.required).width * HALF;
  const ghost: OrbitGhost = {
    ...pointAlong(LADDER_GHOST_PX * HALF),
    key: counter.traitId,
    hasUnlockRing: counter.isUnlocked,
  };
  return {
    span: { startDeg, endDeg: startDeg + orbitDegreesOf(lengthPx, radiusPx) },
    ghosts: counter.isGhostHidden ? [] : [ghost],
    pipBlocks: [
      {
        ...pointAlong(blockCentrePx),
        variant: counter.variant,
        eaten: clamp(counter.eaten, NO_PIPS, counter.required),
        required: counter.required,
      },
    ],
  };
}

/**
 * The backings under the spans, padded at both ends and merged where two would overlap, so a rung
 * ghost beside a counter (decision #285 B) reads as one band rather than a darker double seam. Every
 * §9 angle lies in the lower half of the orbit, so no arc crosses 12 o'clock and a sort is enough.
 */
function mergedBackings(spans: readonly OrbitArc[], radiusPx: number): OrbitArc[] {
  const padDeg = orbitDegreesOf(LADDER_BACKING_END_PAD_PX, radiusPx);
  const padded = spans
    .map((span) => ({ startDeg: span.startDeg - padDeg, endDeg: span.endDeg + padDeg }))
    .sort((first, second) => first.startDeg - second.startDeg);
  const merged: OrbitArc[] = [];
  for (const arc of padded) {
    const last = merged[merged.length - 1];
    if (last !== undefined && arc.startDeg <= last.endDeg) {
      merged[merged.length - 1] = { startDeg: last.startDeg, endDeg: Math.max(last.endDeg, arc.endDeg) };
    } else {
      merged.push(arc);
    }
  }
  return merged;
}

/** The ladder orbit for the own cell at `rPx` (UI.md §3.1.2): the rung ghost, then the counters. */
export function orbitLayout(ladder: Ladder, rPx: number): OrbitLayout {
  const radiusPx = ladderOrbitRadiusPx(rPx);
  const ghostGroup = ladder.ghost === null ? null : rungGhostGroup(ladder.ghost, radiusPx);
  const groups = [
    ...(ghostGroup === null ? [] : [ghostGroup]),
    ...ladder.counters.map((counter) =>
      counterGroup(counter, counterCentreDeg(counter, ghostGroup?.span ?? null, radiusPx), radiusPx),
    ),
  ];
  const spans = groups.map((group) => group.span);
  return {
    radiusPx,
    spans,
    backings: mergedBackings(spans, radiusPx),
    ghosts: groups.flatMap((group) => group.ghosts),
    pipBlocks: groups.flatMap((group) => group.pipBlocks),
  };
}
