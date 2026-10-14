// The water's colour and how much floor shows, as functions of the distance to the coast (docs/rendering/opening-dive.md
// §4, ticket #801, the mockup's `rampLut`, `drawShallows` and `depthMask`): tabulated once a level, a quarter of a grid
// cell apart, so the shader reads one texel where it would otherwise composite 28 strokes and 6 masks a pixel. Each
// entry composites the very strokes that would have covered that distance, widest first, over the deep water.

import { SHORE_DEPTH_MASK, SHORE_RAMP_TABLE, SHORE_SHALLOWS } from '../../constants/dive-shore';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS } from '../../colour';
import { HALF } from '../../geometry';
import { rgb255, type Rgb255 } from './shore-pixels';

/** The table: `entries` RGBA8 texels `stepM` apart from the waterline; RGB the water, A the floor's share. */
export interface ShoreSeaRamp {
  readonly bytes: Uint8Array;
  readonly entries: number;
  readonly stepM: number;
}

/** What the table is worked out for: how far a stroke may reach past the view, the grid's cell, the farthest sea. */
export interface SeaRampInputs {
  readonly strokeReachM: number;
  readonly cellM: number;
  readonly farthestM: number;
}

interface ShallowStroke {
  readonly halfWidthM: number;
  readonly rgb: Rgb255;
  readonly alpha: number;
}

function shallowStrokes(strokeReachM: number): ShallowStroke[] {
  const shallows = SHORE_SHALLOWS;
  const far = rgb255(shallows.far);
  const near = rgb255(shallows.near);
  return Array.from({ length: shallows.strokes }, (_unused, index) => {
    const fraction = index / (shallows.strokes - 1);
    const halfWidthM = Math.min(
      strokeReachM,
      shallows.farHalfWidthM * (shallows.nearHalfWidthM / shallows.farHalfWidthM) ** fraction,
    );
    const channel = (from: number, target: number): number => Math.round(from + (target - from) * fraction);
    const rgb: Rgb255 = [
      channel(far[RED], near[RED]),
      channel(far[GREEN], near[GREEN]),
      channel(far[BLUE], near[BLUE]),
    ];
    return {
      halfWidthM,
      rgb,
      alpha: Number((shallows.alphaBase + shallows.alphaGain * fraction).toFixed(shallows.alphaDecimals)),
    };
  });
}

/** A stroke's coverage of a point `distanceM` out, anti-aliased over one cell. */
function cover(halfWidthM: number, distanceM: number, cellM: number): number {
  return Math.min(1, Math.max(0, (halfWidthM - distanceM) / cellM + HALF));
}

/** The water at `distanceM`: the deep, then each shallows stroke over it (source-over). */
function waterAt(strokes: readonly ShallowStroke[], distanceM: number, cellM: number): Rgb255 {
  const deep = rgb255(SHORE_PALETTE.seaDeep);
  let colour: [number, number, number] = [deep[RED], deep[GREEN], deep[BLUE]];
  for (const stroke of strokes) {
    const alpha = stroke.alpha * cover(stroke.halfWidthM, distanceM, cellM);
    if (alpha <= 0) break;
    colour = [
      colour[RED] + (stroke.rgb[RED] - colour[RED]) * alpha,
      colour[GREEN] + (stroke.rgb[GREEN] - colour[GREEN]) * alpha,
      colour[BLUE] + (stroke.rgb[BLUE] - colour[BLUE]) * alpha,
    ];
  }
  return colour;
}

/** How much floor shows at `distanceM`: each depth stroke keeps three quarters of what is under it. */
function floorAt(widths: readonly number[], distanceM: number, cellM: number): number {
  let keep = 1;
  for (const halfWidthM of widths) {
    const covered = cover(halfWidthM, distanceM, cellM);
    if (covered <= 0) break;
    keep *= 1 - SHORE_DEPTH_MASK.share * covered;
  }
  return 1 - keep;
}

/** The level's table, out to the farthest sea in its grid or the widest stroke's reach, whichever is nearer. */
export function shoreSeaRamp(inputs: SeaRampInputs): ShoreSeaRamp {
  const strokes = shallowStrokes(inputs.strokeReachM);
  const widths = SHORE_DEPTH_MASK.halfWidthsM.map((halfWidthM) => Math.min(halfWidthM, inputs.strokeReachM));
  const top = Math.min(inputs.farthestM, (strokes[0]?.halfWidthM ?? 0) + inputs.cellM);
  let stepM = inputs.cellM / SHORE_RAMP_TABLE.entriesPerCell;
  let entries = Math.max(1, Math.ceil(top / stepM) + 1);
  if (entries > SHORE_RAMP_TABLE.maxEntries) {
    entries = SHORE_RAMP_TABLE.maxEntries;
    stepM = top / (entries - 1);
  }
  const bytes = new Uint8Array(entries * RGBA_CHANNELS);
  for (let entry = 0; entry < entries; entry += 1) {
    const distanceM = entry * stepM;
    const water = waterAt(strokes, distanceM, inputs.cellM);
    const base = entry * RGBA_CHANNELS;
    bytes[base + RED] = Math.round(water[RED]);
    bytes[base + GREEN] = Math.round(water[GREEN]);
    bytes[base + BLUE] = Math.round(water[BLUE]);
    bytes[base + ALPHA] = Math.round(floorAt(widths, distanceM, inputs.cellM) * CHANNEL_MAX);
  }
  return { bytes, entries, stepM };
}
