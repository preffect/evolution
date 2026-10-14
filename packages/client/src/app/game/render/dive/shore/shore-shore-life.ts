// The upper shore in a snapshot (docs/rendering/opening-dive.md §4, ticket #801): sand coves where a slow noise says
// so (`drawBeaches`) and driftwood thrown up along the top of the rock band (`drawDriftwood`).

import { SHORE_ZONE_REACH_M } from '../../constants/dive-shore';
import { SHORE_BEACHES, SHORE_DRIFTWOOD } from '../../constants/dive-shore-objects';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { hexWithAlpha } from '../../colour';
import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { DIAMETER_PER_RADIUS, HALF, smoothstep } from '../../geometry';
import { nearCoastCells, type NearCoastCell } from './shore-near-cells';
import { strokeNearPath, type Polyline } from './shore-near-strokes';
import { valueNoise } from './shore-noise';
import { pointCount, pointX, pointY } from './shore-points';
import { pxToMetres, strokeOctaves, type ShorePaint } from './shore-paint';

function isBeach(x: number, y: number): boolean {
  const { broad, fine } = SHORE_BEACHES;
  const noise =
    valueNoise(x / broad.scaleM + broad.offsetX, y / broad.scaleM + broad.offsetY, broad.salt) * broad.weight +
    valueNoise(x / fine.scaleM, y / fine.scaleM, fine.salt) * fine.weight;
  return noise > SHORE_BEACHES.above && Math.hypot(x, y) > SHORE_BEACHES.clearOfFocusM;
}

/** The runs of coast that are beach, as open polylines. */
function beachLines(paint: ShorePaint): number[][] {
  const lines: number[][] = [];
  for (const ring of paint.coast.rings) {
    let open: number[] | null = null;
    for (let index = 0; index < pointCount(ring.points); index += 1) {
      const x = pointX(ring.points, index);
      const y = pointY(ring.points, index);
      if (!isBeach(x, y)) {
        open = null;
        continue;
      }
      if (open === null) {
        open = [];
        lines.push(open);
      }
      open.push(x, y);
    }
  }
  return lines;
}

function strokeOpen(
  paint: ShorePaint,
  lines: readonly Polyline[],
  look: { readonly halfWidthM: number; readonly colour: string },
): void {
  strokeNearPath(paint, lines, { halfWidthM: look.halfWidthM, isClosed: false });
  paint.context.lineWidth = DIAMETER_PER_RADIUS * look.halfWidthM;
  paint.context.strokeStyle = look.colour;
  paint.context.stroke();
}

/** Sand coves, never near the focus: the scene there is rock (`drawBeaches`). */
export function drawBeaches(paint: ShorePaint): void {
  const lines = beachLines(paint);
  if (lines.length === 0) return;
  const { sand, driftLine, wetLine } = SHORE_BEACHES;
  strokeOpen(paint, lines, { halfWidthM: sand.halfWidthM, colour: SHORE_PALETTE.sandBase });
  if (sand.halfWidthM * paint.view.screenPixelsPerMetre > sand.tileFromPx) {
    strokeOctaves(paint, 'sand', { tileM: sand.tileM, alpha: 1, width: DIAMETER_PER_RADIUS * sand.halfWidthM });
  }
  paint.context.lineWidth = DIAMETER_PER_RADIUS * sand.halfWidthM;
  paint.context.strokeStyle = sand.shade;
  paint.context.stroke();
  // the drift line and wet sand
  strokeOpen(paint, lines, {
    halfWidthM: driftLine.halfWidthM,
    colour: hexWithAlpha(SHORE_PALETTE.sandWet, driftLine.alpha),
  });
  strokeOpen(paint, lines, { halfWidthM: wetLine.halfWidthM, colour: wetLine.colour });
}

/** The log lies along the shore: across the coast's distance gradient, give or take a little. */
function logTurn(paint: ShorePaint, cell: NearCoastCell): number {
  const { slopeProbeM, slopeQueryM, turnJitter } = SHORE_DRIFTWOOD;
  const point = (deltaX: number, deltaY: number): number =>
    paint.coast.distance(cell.x + deltaX, cell.y + deltaY, slopeQueryM);
  const gradientX = point(slopeProbeM, 0) - point(-slopeProbeM, 0);
  const gradientY = point(0, slopeProbeM) - point(0, -slopeProbeM);
  return Math.atan2(gradientY, gradientX) + Math.PI * HALF + (cell.size - HALF) * turnJitter;
}

function drawGrain(paint: ShorePaint, log: { readonly length: number; readonly width: number }): void {
  const { grain, end, ring } = SHORE_DRIFTWOOD;
  const context = paint.context;
  const { length, width } = log;
  context.strokeStyle = grain.colour;
  context.lineWidth = Math.max(pxToMetres(paint.view, grain.minPx), width * grain.width);
  for (let line = 0; line < grain.lines; line += 1) {
    const offset = (line / (grain.lines - 1) - HALF) * width * grain.spread;
    context.beginPath();
    context.moveTo(-length * HALF + width * grain.inset, offset);
    const bow = width * grain.bow;
    context.bezierCurveTo(
      -length / grain.sixth,
      offset + bow,
      length / grain.sixth,
      offset - bow,
      length * HALF - width * grain.inset,
      offset,
    );
    context.stroke();
  }
  const endX = length * HALF - width * end.inset;
  context.fillStyle = end.colour;
  context.beginPath();
  context.ellipse(endX, 0, width * end.radiusX, width * end.radiusY, 0, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  context.strokeStyle = ring.colour;
  context.beginPath();
  context.ellipse(endX, 0, width * ring.radiusX, width * ring.radiusY, 0, 0, RADIANS_PER_FULL_TURN);
  context.stroke();
}

function drawLog(paint: ShorePaint, cell: NearCoastCell, alpha: number): void {
  const wood = SHORE_DRIFTWOOD;
  const context = paint.context;
  const length = wood.lengthM.min + cell.size * wood.lengthM.span;
  const width = wood.widthM.min + cell.roll * wood.widthM.span;
  context.save();
  context.translate(cell.x, cell.y);
  context.rotate(logTurn(paint, cell));
  context.globalAlpha = alpha;
  context.fillStyle = wood.shadow.colour;
  context.beginPath();
  context.ellipse(
    width * wood.shadow.x,
    width * wood.shadow.y,
    length * HALF,
    width * wood.shadow.radiusY,
    0,
    0,
    RADIANS_PER_FULL_TURN,
  );
  context.fill();
  const gradient = context.createLinearGradient(0, -width * HALF, 0, width * HALF);
  gradient.addColorStop(0, SHORE_PALETTE.driftLight);
  gradient.addColorStop(wood.middleStop, SHORE_PALETTE.driftBase);
  gradient.addColorStop(1, SHORE_PALETTE.driftDark);
  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(-length * HALF, -width * HALF, length, width, width * HALF);
  context.fill();
  if (width * paint.view.screenPixelsPerMetre > wood.grainFromPx) drawGrain(paint, { length, width });
  context.restore();
}

/** Driftwood thrown up along the top of the rock band (`drawDriftwood`). */
export function drawDriftwood(paint: ShorePaint): void {
  const wood = SHORE_DRIFTWOOD;
  const alpha = smoothstep(wood.showBelowZoom, wood.fullBelowZoom, paint.view.zoom);
  const cells = nearCoastCells(paint, {
    cellM: wood.cellM,
    fromM: SHORE_ZONE_REACH_M.band - wood.belowBandM.near,
    toM: SHORE_ZONE_REACH_M.band - wood.belowBandM.far,
    salt: wood.salt,
    maxCells: wood.maxCells,
  });
  for (const cell of cells) if (cell.roll <= wood.keepBelow) drawLog(paint, cell, alpha);
  paint.context.globalAlpha = 1;
}
