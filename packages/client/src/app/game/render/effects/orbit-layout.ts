// The ladder orbit's layout (docs/ui/hud.md §3.1.2–§3.1.3, docs/rendering/own-cell-indicators.md §10): where the rung ghost,
// each counter's ghost and pip block, and the callout backings under them sit on the orbit of the own
// cell at `r_px`, as angles and px offsets from its centre. A counter is centred on its §9 angle,
// ghost first and pips after, clockwise; beside a rung ghost it turns away until the drawn boxes are
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
import type { Ladder, LadderCounter, LadderGhost, LadderSilhouette } from '../../state/own-cell-ladder';
import { orientedBoxGapPx, type OrientedBox } from './oriented-box';
import { ladderOrbitRadiusPx, orbitDegreesOf, orbitPointPx, type OrbitPoint } from './own-cell-geometry';

const NO_PIPS = 0;
/** Which way a counter turns away from a rung ghost, in degrees clockwise from 12 o'clock. */
const CLOCKWISE = 1;
const COUNTER_CLOCKWISE = -1;
/** The nudge's search bound: a quarter turn, beyond what any own-cell size needs. */
const NUDGE_SEARCH_LIMIT_DEG = 90;
/** Halvings of that bound: 90° / 2³² is far below a px on any orbit. */
const NUDGE_SEARCH_HALVINGS = 32;

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
  /** Clamped to `required` again here: the pip atlas has no entry past it (ui/hud.md §3.1.2). */
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

/** The box a ghost is drawn in: `LADDER_GHOST_PX` square, which bounds every silhouette (the envelope circle fills it). */
export function ghostBoxOf(point: OrbitPoint): OrientedBox {
  const halfPx = LADDER_GHOST_PX * HALF;
  return { x: point.x, y: point.y, rotation: point.rotation, halfLength: halfPx, halfHeight: halfPx };
}

/** The box a pip block is drawn in, its width along the tangent. */
export function pipBlockBoxOf(block: OrbitPoint & { readonly required: number }): OrientedBox {
  const size = pipBlockSizePx(block.required);
  return {
    x: block.x,
    y: block.y,
    rotation: block.rotation,
    halfLength: size.width * HALF,
    halfHeight: size.height * HALF,
  };
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

interface CounterPoints {
  readonly span: OrbitArc;
  readonly ghost: OrbitPoint;
  readonly block: OrbitPoint;
}

/** A counter centred on `centreDeg`: its ghost first, clockwise, then its pip block after the item gap. */
function counterPoints(counter: LadderCounter, centreDeg: number, radiusPx: number): CounterPoints {
  const lengthPx = counterLengthPx(counter.required);
  const startDeg = centreDeg - orbitDegreesOf(lengthPx * HALF, radiusPx);
  const pointAlong = (alongPx: number): OrbitPoint =>
    orbitPointPx(radiusPx, startDeg + orbitDegreesOf(alongPx, radiusPx));
  return {
    span: { startDeg, endDeg: startDeg + orbitDegreesOf(lengthPx, radiusPx) },
    ghost: pointAlong(LADDER_GHOST_PX * HALF),
    block: pointAlong(LADDER_GHOST_PX + LADDER_ITEM_GAP_PX + pipBlockSizePx(counter.required).width * HALF),
  };
}

/** The drawn gap from a rung ghost to the nearer of a counter's two boxes; a hidden ghost's slot still counts. */
function counterGapPx(counter: LadderCounter, centreDeg: number, rungGhostBox: OrientedBox, radiusPx: number): number {
  const points = counterPoints(counter, centreDeg, radiusPx);
  return Math.min(
    orientedBoxGapPx(rungGhostBox, ghostBoxOf(points.ghost)),
    orientedBoxGapPx(rungGhostBox, pipBlockBoxOf({ ...points.block, required: counter.required })),
  );
}

/**
 * Where a counter is centred: on its own angle, unless a rung ghost shares the orbit and the drawn
 * boxes would come nearer than `LADDER_ITEM_CLEARANCE_PX` (decision #285 B at small sizes). Then the
 * ghost keeps its angle and the counter turns away from it, clockwise when it sits clockwise of the
 * ghost (aerobic, 225) and counter-clockwise when it sits before it (photosynthetic, 135), by the
 * smallest turn that clears. The turn is found by halving, because the gap only grows as it turns away.
 */
function counterCentreDeg(counter: LadderCounter, rungGhost: OrbitPoint | null, radiusPx: number): number {
  if (rungGhost === null) return counter.angleDeg;
  const rungGhostBox = ghostBoxOf(rungGhost);
  const awaySign = counter.angleDeg >= rungGhost.angleDeg ? CLOCKWISE : COUNTER_CLOCKWISE;
  const isClearAfter = (turnDeg: number): boolean =>
    counterGapPx(counter, counter.angleDeg + awaySign * turnDeg, rungGhostBox, radiusPx) >= LADDER_ITEM_CLEARANCE_PX;
  if (isClearAfter(0)) return counter.angleDeg;
  let crowdedDeg = 0;
  let clearDeg = NUDGE_SEARCH_LIMIT_DEG;
  for (let halving = 0; halving < NUDGE_SEARCH_HALVINGS; halving += 1) {
    const middleDeg = (crowdedDeg + clearDeg) * HALF;
    if (isClearAfter(middleDeg)) clearDeg = middleDeg;
    else crowdedDeg = middleDeg;
  }
  return counter.angleDeg + awaySign * clearDeg;
}

/** The counter's group at `centreDeg`; a hidden ghost keeps its place so the pips stay. */
function counterGroup(counter: LadderCounter, centreDeg: number, radiusPx: number): OrbitGroup {
  const points = counterPoints(counter, centreDeg, radiusPx);
  const ghost: OrbitGhost = { ...points.ghost, key: counter.traitId, hasUnlockRing: counter.isUnlocked };
  const block: OrbitPipBlock = {
    ...points.block,
    variant: counter.variant,
    eaten: clamp(counter.eaten, NO_PIPS, counter.required),
    required: counter.required,
  };
  return { span: points.span, ghosts: counter.isGhostHidden ? [] : [ghost], pipBlocks: [block] };
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

/** The ladder orbit for the own cell at `rPx` (ui/hud.md §3.1.2): the rung ghost, then the counters. */
export function orbitLayout(ladder: Ladder, rPx: number): OrbitLayout {
  const radiusPx = ladderOrbitRadiusPx(rPx);
  const ghostGroup = ladder.ghost === null ? null : rungGhostGroup(ladder.ghost, radiusPx);
  const rungGhost = ghostGroup?.ghosts[0] ?? null;
  const groups = [
    ...(ghostGroup === null ? [] : [ghostGroup]),
    ...ladder.counters.map((counter) =>
      counterGroup(counter, counterCentreDeg(counter, rungGhost, radiusPx), radiusPx),
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
