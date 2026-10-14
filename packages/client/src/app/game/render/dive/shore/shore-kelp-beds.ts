// Kelp beds offshore (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `kelpBeds`, `bedPath`,
// `drawKelpBeds` and `kelpPlants`): the hand-placed beds near the focus and, closer in, more scattered by the world's
// hash; each a clump of lobes filled with the canopy tile, far or near, and below z 2.3 its single plants.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SHORE_KELP_BEDS, SHORE_KELP_PATCHES, SHORE_KELP_PLANTS } from '../../constants/dive-shore';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { HALF, smoothstep } from '../../geometry';
import { coordinateHash } from './shore-noise';
import { isInView, paintTrue, trueTileWeight, type ShorePaint } from './shore-paint';

interface KelpBed {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly seed: number;
}

function scatteredBeds(paint: ShorePaint): KelpBed[] {
  const beds = SHORE_KELP_BEDS;
  const { view } = paint;
  const cell = beds.cellM;
  const column0 = Math.floor(-view.halfWidthM / cell) - 1;
  const column1 = Math.floor(view.halfWidthM / cell) + 1;
  const row0 = Math.floor(-view.halfHeightM / cell) - 1;
  const row1 = Math.floor(view.halfHeightM / cell) + 1;
  if ((column1 - column0) * (row1 - row0) >= beds.maxCells) return [];
  const found: KelpBed[] = [];
  for (let column = column0; column <= column1; column += 1) {
    for (let row = row0; row <= row1; row += 1) {
      if (coordinateHash(column, row, beds.salts.keep) > beds.keepBelow) continue;
      const x = (column + coordinateHash(column, row, beds.salts.x)) * cell;
      const y = (row + coordinateHash(column, row, beds.salts.y)) * cell;
      if (Math.hypot(x, y) < beds.clearOfFocusM) continue; // near the focus the fixed beds rule
      const radius = beds.radiusM.min + coordinateHash(column, row, beds.salts.radius) * beds.radiusM.span;
      found.push({ x, y, radius, seed: column * beds.seed.column + row });
    }
  }
  return found;
}

/** The beds in view, each well offshore (`kelpBeds`). */
function kelpBeds(paint: ShorePaint): KelpBed[] {
  const beds = SHORE_KELP_BEDS;
  const placed = SHORE_KELP_PATCHES.map(([x, y, radius]) => ({ x, y, radius, seed: Math.round(x * beds.seed.x + y) }));
  const all = paint.view.zoom < beds.scatterBelowZoom ? [...placed, ...scatteredBeds(paint)] : placed;
  return all.filter((bed) => {
    if (!isInView(paint.view, bed, bed.radius * beds.visibleRadii)) return false;
    const distance = paint.coast.distance(bed.x, bed.y, beds.queryM);
    const offshore = -bed.radius * beds.clearOfCoastRadii - beds.clearOfCoastM;
    return !Number.isNaN(distance) && distance < offshore && distance > -beds.farthestM;
  });
}

/** A bed's lobes as one path (`bedPath`). */
function bedPath(paint: ShorePaint, bed: KelpBed): void {
  const beds = SHORE_KELP_BEDS;
  const { salts } = beds;
  const context = paint.context;
  context.beginPath();
  for (let lobe = 0; lobe < beds.lobes; lobe += 1) {
    const angle = coordinateHash(lobe, bed.seed, salts.lobeAngle) * RADIANS_PER_FULL_TURN;
    const radius =
      bed.radius * (beds.lobeRadius.min + coordinateHash(lobe, bed.seed, salts.lobeRadius) * beds.lobeRadius.span);
    const reach = coordinateHash(lobe, bed.seed, salts.lobeDistance) * beds.lobeDistance;
    const x = bed.x + Math.cos(angle) * bed.radius * reach;
    const y = bed.y + Math.sin(angle) * bed.radius * reach * beds.lobeSquash;
    context.moveTo(x + radius * beds.lobeWidth, y);
    context.ellipse(x, y, radius * beds.lobeWidth, radius * beds.lobeHeight, beds.lobeTurn, 0, RADIANS_PER_FULL_TURN);
  }
}

function drawBed(paint: ShorePaint, bed: KelpBed, weight: number): void {
  const beds = SHORE_KELP_BEDS;
  const context = paint.context;
  bedPath(paint, bed);
  context.fillStyle = `rgba(${beds.fill.rgb},${beds.fill.alpha * weight})`;
  context.fill();
  context.lineWidth = bed.radius * beds.edge.widthRadii;
  context.strokeStyle = `rgba(${beds.fill.rgb},${beds.edge.alpha * weight})`;
  context.stroke();
  context.save();
  context.clip();
  const near = trueTileWeight(paint.view.screenPixelsPerMetre, beds.nearTile.tileM);
  if (near < 1) {
    bedPath(paint, bed);
    paintTrue(paint, 'kelpbedFar', {
      tileM: beds.farTile.tileM,
      alpha: beds.farTile.alpha * weight * (1 - near),
      isStroke: false,
    });
  }
  if (near > 0) {
    bedPath(paint, bed);
    paintTrue(paint, 'kelpbed', {
      tileM: beds.nearTile.tileM,
      alpha: beds.nearTile.alpha * weight * near,
      isStroke: false,
    });
  }
  context.restore();
}

/** Kelp beds offshore: their lobes, the canopy tile in them, and close in their single plants (`drawKelpBeds`). */
export function drawKelpBeds(paint: ShorePaint): void {
  const beds = SHORE_KELP_BEDS;
  const zoom = paint.view.zoom;
  if (zoom > beds.showBelowZoom) return;
  const weight = smoothstep(beds.showBelowZoom, beds.fullBelowZoom, zoom);
  for (const bed of kelpBeds(paint)) {
    drawBed(paint, bed, weight);
    if (zoom < SHORE_KELP_PLANTS.showBelowZoom) drawPlants(paint, bed);
  }
}

function drawBlades(
  paint: ShorePaint,
  point: { readonly x: number; readonly y: number; readonly column: number; readonly row: number },
): void {
  const plants = SHORE_KELP_PLANTS;
  const context = paint.context;
  const sway =
    Math.sin(
      paint.view.timeSeconds * plants.sway.rate + point.column * plants.sway.column + point.row * plants.sway.row,
    ) * plants.sway.amount;
  for (let blade = 0; blade < plants.blades; blade += 1) {
    const jitter =
      (coordinateHash(point.column, point.row, plants.salts.bladeAngle + blade) - HALF) * plants.bladeJitter;
    const angle = plants.bladeAngle + sway + (blade - plants.bladeMiddle) * plants.bladeFan + jitter;
    const length =
      plants.bladeLengthM.min +
      coordinateHash(point.column, point.row, plants.salts.bladeLength + blade) * plants.bladeLengthM.span;
    context.strokeStyle = plants.bladeColours[blade % plants.bladeColours.length] ?? '';
    context.lineWidth = plants.bladeWidthM;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.quadraticCurveTo(
      point.x + Math.cos(angle) * length * HALF + plants.bladeBendM.x,
      point.y + Math.sin(angle) * length * HALF + plants.bladeBendM.y,
      point.x + Math.cos(angle + sway) * length,
      point.y + Math.sin(angle + sway) * length,
    );
    context.stroke();
  }
}

function drawBulb(paint: ShorePaint, point: { readonly x: number; readonly y: number }): void {
  const { shadow, bulb } = SHORE_KELP_PLANTS;
  const context = paint.context;
  context.fillStyle = shadow.colour;
  context.beginPath();
  context.arc(point.x + shadow.x, point.y + shadow.y, shadow.radiusM, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  const gradient = context.createRadialGradient(
    point.x + bulb.lightX,
    point.y + bulb.lightY,
    bulb.coreM,
    point.x,
    point.y,
    bulb.radiusM,
  );
  gradient.addColorStop(0, SHORE_PALETTE.kelpGlow);
  gradient.addColorStop(bulb.baseStop, SHORE_PALETTE.kelpBase);
  gradient.addColorStop(1, SHORE_PALETTE.kelpDark);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(point.x, point.y, bulb.radiusM, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

function plantAt(
  paint: ShorePaint,
  bed: KelpBed,
  cell: { readonly column: number; readonly row: number },
): { x: number; y: number } | null {
  const plants = SHORE_KELP_PLANTS;
  const { column, row } = cell;
  if (coordinateHash(column, row, plants.salts.keep) > plants.keepBelow) return null;
  const x = (column + coordinateHash(column, row, plants.salts.x)) * plants.cellM;
  const y = (row + coordinateHash(column, row, plants.salts.y)) * plants.cellM;
  const isInBed =
    Math.hypot((x - bed.x) / plants.bedSquash.x, (y - bed.y) / plants.bedSquash.y) <= bed.radius * plants.insideBed;
  return isInBed && isInView(paint.view, { x, y }, plants.visibleM) ? { x, y } : null;
}

/** A bed's single plants: a bulb and a sheaf of blades streaming down-current (`kelpPlants`). */
function drawPlants(paint: ShorePaint, bed: KelpBed): void {
  const plants = SHORE_KELP_PLANTS;
  const cell = plants.cellM;
  const column0 = Math.floor((bed.x - bed.radius * plants.bedReach.x) / cell);
  const column1 = Math.floor((bed.x + bed.radius * plants.bedReach.x) / cell);
  const row0 = Math.floor((bed.y - bed.radius * plants.bedReach.y) / cell);
  const row1 = Math.floor((bed.y + bed.radius * plants.bedReach.y) / cell);
  if ((column1 - column0) * (row1 - row0) > plants.maxCells) return;
  const context = paint.context;
  context.lineCap = 'round';
  context.globalAlpha = smoothstep(plants.showBelowZoom, plants.fullBelowZoom, paint.view.zoom);
  for (let column = column0; column <= column1; column += 1) {
    for (let row = row0; row <= row1; row += 1) {
      const point = plantAt(paint, bed, { column, row });
      if (point === null) continue;
      drawBlades(paint, { ...point, column, row });
      drawBulb(paint, point);
    }
  }
  context.globalAlpha = 1;
}
