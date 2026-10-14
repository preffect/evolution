// Tide pools (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `pool` and `drawPools`): a wet rim, a pink
// crust and the water with the sky in it; close up, the rock through the water, sea lettuce and anemones on the
// bottom. The glint on each pool is drawn at the snapshot's clock (its breathing is the mockup's only motion here).

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SHORE_FIXED_POOL, SHORE_FOCAL_ROCK, SHORE_POOLS } from '../../constants/dive-shore-objects';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { hexWithAlpha } from '../../colour';
import { HALF, smoothstep } from '../../geometry';
import { nearCoastCells } from './shore-near-cells';
import { coordinateHash } from './shore-noise';
import { placedPattern, pxToMetres, type ShorePaint } from './shore-paint';
import { poolPath, type BlobPlace } from './shore-shapes';

function scaled(place: BlobPlace, radius: number): BlobPlace {
  return { ...place, radius: place.radius * radius };
}

function drawWater(paint: ShorePaint, place: BlobPlace): void {
  const { water } = SHORE_POOLS;
  const context = paint.context;
  const { x, y, radius } = place;
  poolPath(context, place);
  const gradient = context.createRadialGradient(
    x + radius * water.lightX,
    y + radius * water.lightY,
    radius * water.core,
    x,
    y,
    radius,
  );
  gradient.addColorStop(0, water.stops[0]);
  gradient.addColorStop(water.middleStop, water.stops[1]);
  gradient.addColorStop(1, water.stops[2]);
  context.fillStyle = gradient;
  context.fill();
}

function drawBottomLife(paint: ShorePaint, place: BlobPlace): void {
  const { bottom } = SHORE_POOLS;
  const context = paint.context;
  const { x, y, radius, seed, squash } = place;
  for (let thing = 0; thing < bottom.count; thing += 1) {
    const atX = x + (coordinateHash(seed, thing, bottom.salts.x) - HALF) * radius * bottom.spreadX;
    const atY = y + (coordinateHash(seed, thing, bottom.salts.y) - HALF) * radius * squash * bottom.spreadY;
    const size = radius * (bottom.radius.min + coordinateHash(seed, thing, bottom.salts.radius) * bottom.radius.span);
    if (thing < bottom.weeds) {
      context.fillStyle = bottom.weed.colour;
      context.beginPath();
      context.ellipse(
        atX,
        atY,
        size * bottom.weed.radiusX,
        size * bottom.weed.radiusY,
        thing,
        0,
        RADIANS_PER_FULL_TURN,
      );
      context.fill();
      continue;
    }
    const anemone = bottom.anemone;
    context.fillStyle = anemone.colour;
    context.beginPath();
    context.arc(atX, atY, size, 0, RADIANS_PER_FULL_TURN);
    context.fill();
    context.strokeStyle = anemone.colourTentacle;
    context.lineWidth = size * anemone.width;
    for (let tentacle = 0; tentacle < anemone.tentacles; tentacle += 1) {
      const angle = (tentacle / anemone.tentacles) * RADIANS_PER_FULL_TURN;
      context.beginPath();
      context.moveTo(atX + Math.cos(angle) * size * anemone.from, atY + Math.sin(angle) * size * anemone.from);
      context.lineTo(atX + Math.cos(angle) * size * anemone.to, atY + Math.sin(angle) * size * anemone.to);
      context.stroke();
    }
  }
}

/** Close up: the rock through the water, the life on the bottom, the sky in the surface. */
function drawPoolDetail(paint: ShorePaint, place: BlobPlace): void {
  const { floorTile, sky } = SHORE_POOLS;
  const context = paint.context;
  const { x, y, radius } = place;
  context.save();
  context.clip();
  context.globalCompositeOperation = 'multiply';
  const rock = placedPattern(paint, 'rock', { tileM: radius * floorTile.radius });
  if (rock !== null) {
    context.fillStyle = rock;
    context.globalAlpha = floorTile.alpha;
    context.fill();
  }
  // as the mockup: the pool's floor life and sky draw at full strength, whatever the pools' fade
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  drawBottomLife(paint, place);
  const gradient = context.createLinearGradient(
    x + radius * sky.from.x,
    y + radius * sky.from.y,
    x + radius * sky.to.x,
    y + radius * sky.to.y,
  );
  sky.stops.forEach((colour, index) => gradient.addColorStop(index / (sky.stops.length - 1), colour));
  context.fillStyle = gradient;
  context.fillRect(x + radius * sky.box.x, y + radius * sky.box.y, radius * sky.box.width, radius * sky.box.height);
  context.restore();
}

/** One pool (`pool`). */
function drawPool(paint: ShorePaint, place: BlobPlace): void {
  const pools = SHORE_POOLS;
  const scale = paint.view.screenPixelsPerMetre;
  if (place.radius * scale < pools.minRadiusPx) return;
  const context = paint.context;
  poolPath(context, scaled(place, pools.rim.radius));
  context.fillStyle = pools.rim.colour;
  context.fill();
  poolPath(context, scaled(place, pools.crust.radius));
  context.fillStyle = hexWithAlpha(SHORE_PALETTE.coralline, pools.crust.alpha);
  context.fill();
  drawWater(paint, place);
  if (place.radius * scale > pools.detailFromPx) drawPoolDetail(paint, place);
  poolPath(context, place);
  context.strokeStyle = pools.edge.colour;
  context.lineWidth = Math.max(pxToMetres(paint.view, pools.edge.minPx), place.radius * pools.edge.width);
  context.stroke();
  const glint = pools.glint;
  const breath = HALF + HALF * Math.sin(paint.view.timeSeconds * glint.rate + place.seed);
  context.fillStyle = `rgba(${glint.rgb},${glint.alpha * breath})`;
  context.beginPath();
  const { x, y, radius, squash } = place;
  context.ellipse(
    x + radius * glint.x,
    y + radius * glint.y * squash,
    radius * glint.radiusX,
    radius * glint.radiusY,
    glint.turn,
    0,
    RADIANS_PER_FULL_TURN,
  );
  context.fill();
}

function isClearOfFixedThings(x: number, y: number): boolean {
  const pools = SHORE_POOLS;
  const rock = SHORE_FOCAL_ROCK;
  const pool = SHORE_FIXED_POOL;
  return (
    Math.hypot(x - rock.x, y - rock.y) >= pools.clearOfRockM && Math.hypot(x - pool.x, y - pool.y) >= pools.clearOfPoolM
  );
}

/** Tide pools up the shore, and the one the mockup places by hand (`drawPools`). */
export function drawPools(paint: ShorePaint): void {
  const pools = SHORE_POOLS;
  const alpha = smoothstep(pools.showBelowZoom, pools.fullBelowZoom, paint.view.zoom);
  const cells = nearCoastCells(paint, {
    cellM: pools.cellM,
    fromM: pools.nearM,
    toM: pools.farM,
    salt: pools.salt,
    maxCells: pools.maxCells,
  });
  for (const cell of cells) {
    if (cell.roll > pools.keepBelow || !isClearOfFixedThings(cell.x, cell.y)) continue;
    paint.context.globalAlpha = alpha;
    const radius = pools.radiusM.min + cell.size * cell.size * pools.radiusM.span;
    drawPool(paint, {
      x: cell.x,
      y: cell.y,
      radius,
      seed: cell.column * pools.seed.column + cell.row,
      squash: pools.squash.min + cell.roll,
    });
  }
  const fixed = SHORE_FIXED_POOL;
  paint.context.globalAlpha = alpha;
  drawPool(paint, {
    x: fixed.x,
    y: fixed.y,
    radius: fixed.radiusXM,
    seed: fixed.seed,
    squash: fixed.radiusYM / fixed.radiusXM,
  });
  paint.context.globalAlpha = 1;
}
