// The arc primitive's instance rows (docs/RENDERING.md §10): every ring, track and arc the own-cell
// indicators draw — the DNA track and fill, the ladder backings, the unlock rings, the escape track and
// arc — as one row each in a small float table the arc shader reads (`arc-shader.ts`). A row is a centre
// in the layer's world units, a radius and a stroke in screen px turned into world units by the zoom, a
// start angle and a clockwise sweep, its cap, and a straight colour with its alpha. A round cap reaches half
// the stroke past each end (the DNA fill, the escape arc); a butt end stops exactly at the angle (the ladder
// backings, whose padded, merged spans already say where they end). A sweep of a whole turn or more is the
// full ring. Pure.
//
// `startDeg` is the record's convention, **degrees clockwise from 12 o'clock** (UI.md §3.1.2); the row
// holds screen radians from 3 o'clock, and `screenRadiansOf` is the one turn between the two.

import { RADIANS_PER_FULL_TURN, type ValueOf } from '@evolution/shared';
import { RGBA_CHANNELS, hexToRgb } from '../colour';
import { ARC_INSTANCE_FIELD, ARC_INSTANCE_TEXELS } from '../constants';
import { HALF } from '../geometry';
import { screenRadiansOf } from './own-cell-geometry';

/** Floats per arc row: `ARC_INSTANCE_TEXELS` RGBA texels. */
export const ARC_INSTANCE_FLOATS = ARC_INSTANCE_TEXELS * RGBA_CHANNELS;

/** How an arc ends: `round` reaches half the stroke past the angle, `butt` stops on it. */
export const ARC_CAP = { round: 'round', butt: 'butt' } as const;
export type ArcCap = ValueOf<typeof ARC_CAP>;

const ROUND_CAP_FLAG = 1;
const BUTT_CAP_FLAG = 0;

export interface ArcInstance {
  /** The centre in the layer's world units (the own cell's predicted centre). */
  readonly x: number;
  readonly y: number;
  /** The stroke's centre line, in screen px. */
  readonly radiusPx: number;
  readonly strokePx: number;
  /** Where the arc starts, degrees clockwise from 12 o'clock. */
  readonly startDeg: number;
  /** How much of a turn it covers, clockwise from the start: 0 draws nothing, 1 or more the whole ring. */
  readonly sweep: number;
  readonly cap: ArcCap;
  readonly colour: string;
  readonly alpha: number;
}

/** Round caps would leave a dot at an empty fill, so an arc that covers nothing is no row at all. */
function isDrawn(arc: ArcInstance): boolean {
  return arc.sweep > 0 && arc.alpha > 0 && arc.strokePx > 0;
}

function writeRow(arc: ArcInstance, zoom: number, target: Float32Array, row: number): void {
  const base = row * ARC_INSTANCE_FLOATS;
  const [red, green, blue] = hexToRgb(arc.colour);
  const field = ARC_INSTANCE_FIELD;
  target[base + field.x] = arc.x;
  target[base + field.y] = arc.y;
  target[base + field.radius] = arc.radiusPx / zoom;
  target[base + field.halfStroke] = (arc.strokePx * HALF) / zoom;
  target[base + field.startRadians] = screenRadiansOf(arc.startDeg);
  target[base + field.sweepRadians] = Math.min(arc.sweep, 1) * RADIANS_PER_FULL_TURN;
  target[base + field.isRoundCap] = arc.cap === ARC_CAP.round ? ROUND_CAP_FLAG : BUTT_CAP_FLAG;
  target[base + field.red] = red;
  target[base + field.green] = green;
  target[base + field.blue] = blue;
  target[base + field.alpha] = arc.alpha;
}

/**
 * Writes the drawn arcs into `target` in order, up to `capacity` rows, and returns how many rows it
 * wrote: the instance count of the one draw call.
 */
export function packArcInstances(
  arcs: readonly ArcInstance[],
  zoom: number,
  target: Float32Array,
  capacity: number,
): number {
  let rows = 0;
  for (const arc of arcs) {
    if (rows >= capacity) break;
    if (!isDrawn(arc)) continue;
    writeRow(arc, zoom, target, rows);
    rows += 1;
  }
  return rows;
}
