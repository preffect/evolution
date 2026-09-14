// The own cell's self ring as the sprint ring (docs/ui/hud.md §3.1.2, docs/rendering/own-cell-indicators.md §10): what the
// cell layer is told about it — the recharged share, the `sprint_ready` brighten and the predator
// whose warning ring hides while the own cell escapes — and the arc's coordinate. The coordinate is
// the TypeScript reference of the GLSL in `cell-shader-membrane.ts`, which reads the same constant,
// so the clockwise-from-12 turn is pinned in one place. Pure.

import { RADIANS_PER_FULL_TURN, type EntityId } from '@evolution/shared';
import { SELF_RING_ALPHA } from '../constants';
import { wrapUnit } from '../geometry';

export interface OwnCellRing {
  /** 0..1 recharged, clockwise from 12 o'clock; 1 when ready and while sprinting. */
  readonly fill: number;
  /** The recharged arc's alpha: `SELF_RING_ALPHA`, or the `sprint_ready` clip's `selfRingBrightness` while it plays. */
  readonly brightness: number;
  /** The engulfing predator while the own cell is escaping (the record's `escape.predatorCellId`); `null` otherwise. */
  readonly escapePredatorCellId: EntityId | null;
  /**
   * Whether the escape arc replaces that predator's warning ring (docs/ui/hud.md §3.1.2). The arc is #187's, so until it
   * draws this stays false and the predator keeps its ring: the own cell is never left without a danger tell.
   */
  readonly shouldHidePredatorRing: boolean;
}

/** A whole ring: the sprint is ready, or running. */
export const FULL_SELF_RING = 1;

/** No own cell, or one at rest: a full ring at its own alpha, and every warning ring drawn. */
export const REST_OWN_CELL_RING: OwnCellRing = {
  fill: FULL_SELF_RING,
  brightness: SELF_RING_ALPHA,
  escapePredatorCellId: null,
  shouldHidePredatorRing: false,
};

/**
 * `atan2` turns from 3 o'clock with + toward +y; world y points down the screen, so + is clockwise
 * and 12 o'clock is a quarter turn back. Adding this quarter makes 12 o'clock zero.
 */
export const TWELVE_O_CLOCK_TURNS = 0.25;

/** The fragment at `(x, y)` from the cell centre as turns clockwise from 12 o'clock, in [0, 1). */
export function selfRingTurnsFromTwelve(x: number, y: number): number {
  return wrapUnit(Math.atan2(y, x) / RADIANS_PER_FULL_TURN + TWELVE_O_CLOCK_TURNS);
}

/** The engulfing predator's warning ring hides only while the escape arc replaces it; every other cell keeps its ring. */
export function isWarningRingHidden(cellId: EntityId, ring: OwnCellRing): boolean {
  return ring.shouldHidePredatorRing && ring.escapePredatorCellId !== null && ring.escapePredatorCellId === cellId;
}
