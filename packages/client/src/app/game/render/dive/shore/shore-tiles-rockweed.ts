// Rockweed at true scale (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `BAKES.rockweed`): forked
// olive fronds with air bladders and swollen tips, the tile 0.9 m across. Each clump's strokes are recorded once and
// replayed at every wrapped offset, so the seams match.

import { RADIANS_PER_FULL_TURN, type RandomSource } from '@evolution/shared';
import { SHORE_PALETTE, SHORE_ROCKWEED_TILE } from '../../constants/dive-shore-tiles';
import { HALF } from '../../geometry';
import type { ShoreContext2D } from './shore-canvas';
import { shoreRandom } from './shore-noise';
import { wrapDraw } from './shore-pixels';
import type { TileBake } from './shore-tiles-rock';

interface FrondStroke {
  readonly kind: 'stroke';
  readonly fromX: number;
  readonly fromY: number;
  readonly controlX: number;
  readonly controlY: number;
  readonly toX: number;
  readonly toY: number;
  readonly width: number;
  readonly colour: string;
}

/** A bladder pair or a swollen tip on a frond. */
interface FrondMark {
  readonly kind: 'bladder' | 'tip';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly angle: number;
}

type FrondOperation = FrondStroke | FrondMark;

interface Frond {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly width: number;
  readonly depth: number;
}

const QUARTER_TURN = Math.PI * HALF;

function pushFrond(operations: FrondOperation[], random: RandomSource, frond: Frond): void {
  const tile = SHORE_ROCKWEED_TILE;
  const { x, y, angle, length, width, depth } = frond;
  const toX = x + Math.cos(angle) * length;
  const toY = y + Math.sin(angle) * length;
  operations.push({
    kind: 'stroke',
    fromX: x,
    fromY: y,
    controlX: (x + toX) * HALF + Math.cos(angle + QUARTER_TURN) * length * tile.bend,
    controlY: (y + toY) * HALF + Math.sin(angle + QUARTER_TURN) * length * tile.bend,
    toX,
    toY,
    width,
    colour: depth >= tile.maxDepth ? SHORE_PALETTE.rockweedLight : SHORE_PALETTE.rockweedBase,
  });
  if (depth > 0 && random.nextFloat() < tile.bladderChance) {
    operations.push({ kind: 'bladder', x: (x + toX) * HALF, y: (y + toY) * HALF, width, angle });
  }
  if (depth >= tile.maxDepth) {
    operations.push({ kind: 'tip', x: toX, y: toY, width, angle });
    return;
  }
  const child = { x: toX, y: toY, length: length * tile.forkLength, width: width * tile.forkWidth, depth: depth + 1 };
  pushFrond(operations, random, {
    ...child,
    angle: angle - tile.forkTurn.min - random.nextFloat() * tile.forkTurn.span,
  });
  pushFrond(operations, random, {
    ...child,
    angle: angle + tile.forkTurn.min + random.nextFloat() * tile.forkTurn.span,
  });
}

function strokePath(context: ShoreContext2D, stroke: FrondStroke, offset: readonly [number, number]): void {
  const [x, y] = offset;
  context.beginPath();
  context.moveTo(stroke.fromX + x, stroke.fromY + y);
  context.quadraticCurveTo(stroke.controlX + x, stroke.controlY + y, stroke.toX + x, stroke.toY + y);
}

function drawShadows(
  context: ShoreContext2D,
  operations: readonly FrondOperation[],
  offset: readonly [number, number],
): void {
  const shadow = SHORE_ROCKWEED_TILE.shadow;
  context.strokeStyle = shadow.colour;
  for (const operation of operations) {
    if (operation.kind !== 'stroke') continue;
    context.lineWidth = operation.width + shadow.extraWidth;
    strokePath(context, operation, [offset[0] + shadow.x, offset[1] + shadow.y]);
    context.stroke();
  }
}

function drawStroke(context: ShoreContext2D, stroke: FrondStroke, offset: readonly [number, number]): void {
  const tile = SHORE_ROCKWEED_TILE;
  context.strokeStyle = SHORE_PALETTE.rockweedDark;
  context.lineWidth = stroke.width + tile.edge.extraWidth;
  strokePath(context, stroke, offset);
  context.stroke();
  context.strokeStyle = stroke.colour;
  context.lineWidth = stroke.width;
  context.stroke();
  context.strokeStyle = tile.sheen.colour;
  context.lineWidth = tile.sheen.widthPx;
  context.stroke();
}

function drawBladders(context: ShoreContext2D, mark: FrondMark, offset: readonly [number, number]): void {
  const bladder = SHORE_ROCKWEED_TILE.bladder;
  for (const side of [-1, 1]) {
    const x = mark.x + offset[0] + Math.cos(mark.angle + QUARTER_TURN) * side * mark.width * bladder.offset;
    const y = mark.y + offset[1] + Math.sin(mark.angle + QUARTER_TURN) * side * mark.width * bladder.offset;
    const gradient = context.createRadialGradient(
      x - bladder.lightPx,
      y - bladder.lightPx,
      bladder.coreRadius,
      x,
      y,
      mark.width * bladder.gradientRadius,
    );
    gradient.addColorStop(0, bladder.light);
    gradient.addColorStop(1, SHORE_PALETTE.rockweedBase);
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(
      x,
      y,
      mark.width * bladder.radiusX,
      mark.width * bladder.radiusY,
      mark.angle,
      0,
      RADIANS_PER_FULL_TURN,
    );
    context.fill();
  }
}

function drawTip(context: ShoreContext2D, mark: FrondMark, offset: readonly [number, number]): void {
  const tip = SHORE_ROCKWEED_TILE.tip;
  context.fillStyle = tip.colour;
  context.beginPath();
  context.ellipse(
    mark.x + offset[0],
    mark.y + offset[1],
    mark.width * tip.radiusX,
    mark.width * tip.radiusY,
    mark.angle,
    0,
    RADIANS_PER_FULL_TURN,
  );
  context.fill();
}

function drawClump(
  context: ShoreContext2D,
  operations: readonly FrondOperation[],
  offset: readonly [number, number],
): void {
  // shade on the rock first (down-right of the light), then the fronds
  drawShadows(context, operations, offset);
  for (const operation of operations) {
    if (operation.kind === 'stroke') drawStroke(context, operation, offset);
    else if (operation.kind === 'bladder') drawBladders(context, operation, offset);
    else drawTip(context, operation, offset);
  }
}

/** Rockweed: forked olive fronds with swollen tips, true scale: the tile is 0.9 m (`BAKES.rockweed`). */
export const bakeRockweed: TileBake = function* (kit) {
  const tile = SHORE_ROCKWEED_TILE;
  const canvas = kit.factory.create(tile.sizePx, tile.sizePx);
  const context = canvas.context;
  const random = shoreRandom('rockweed');
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let clump = 0; clump < tile.clumps; clump += 1) {
    yield;
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const startAngle = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const operations: FrondOperation[] = [];
    for (let frond = 0; frond < tile.fronds; frond += 1) {
      const angle = startAngle + frond * tile.frondTurn + random.nextFloat() * tile.frondJitter;
      const length = tile.lengthPx.min + random.nextFloat() * tile.lengthPx.span;
      pushFrond(operations, random, { x, y, angle, length, width: tile.widthPx, depth: 0 });
    }
    wrapDraw(tile.sizePx, { x, y, reach: tile.reachPx }, (atX, atY) =>
      drawClump(context, operations, [atX - x, atY - y]),
    );
  }
  return canvas;
};
