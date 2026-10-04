// The kelp's surface cells as two tiles (docs/rendering/opening-dive.md §4, ticket #803, the mockup's `cellGeom`,
// `cellFieldG`, `plastids`, `BAKES.cells` and `BAKES.cellsDark`): polygonal cells about 12 µm across on a brick-offset
// jittered grid that wraps, one field of distances worked out once for both looks — brown cells with bright walls in
// bright field, and their walls glowing over the dark in dark field — each with its plastids and nucleus drawn over.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { CHANNEL_MAX } from '../../colour';
import {
  SLIME_CELLS_BRIGHT,
  SLIME_CELLS_DARK,
  SLIME_CELL_GEOMETRY,
  SLIME_CELL_PLASTIDS,
} from '../../constants/dive-slime-cells';
import { SLIME_PALETTE } from '../../constants/dive-slime';
import { DIAMETER_PER_RADIUS, HALF } from '../../geometry';
import type { ShoreCanvas, ShoreCanvasFactory, ShoreContext2D } from '../shore/shore-canvas';
import { coordinateHash, lerp } from '../shore/shore-noise';
import { clampUnit, pixelBake, ramp3, rampOf, rgb255, wrapDraw, type PixelColour } from '../shore/shore-pixels';

/** One cell's site in tile units and its shade roll. */
export interface CellSite {
  readonly across: number;
  readonly down: number;
  readonly shade: number;
}

/** Per pixel: the distance from the nearest site to the second (the wall), to the nearest site, and which site. */
export interface CellField {
  readonly sizePx: number;
  readonly edge: Float32Array;
  readonly centre: Float32Array;
  readonly site: Uint16Array;
}

const GEOMETRY = SLIME_CELL_GEOMETRY;
const FAR = 9;

/** The sites, column by column within each row, as the mockup lists them. */
export function cellSites(): CellSite[] {
  const { columns, rows, rowOffset, rowCycle, jitterX, jitterY, salts } = GEOMETRY;
  const sites: CellSite[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offset = (row % rowCycle) * rowOffset;
      sites.push({
        across: (column + offset + HALF + (coordinateHash(column, row, salts.x) - HALF) * jitterX) / columns,
        down: (row + HALF + (coordinateHash(column, row, salts.y) - HALF) * jitterY) / rows,
        shade: coordinateHash(column, row, salts.shade),
      });
    }
  }
  return sites;
}

function wrap(index: number, period: number): number {
  return ((index % period) + period) % period;
}

/** The nearest two sites to the tile point among the rows either side and the columns round it. */
function nearestSites(sites: readonly CellSite[], across: number, down: number): [number, number, number] {
  const { columns, rows, stretchX, columnsBefore, columnsAfter } = GEOMETRY;
  const rowAt = Math.floor(down * rows);
  const columnAt = Math.floor(across * columns);
  let nearest = FAR;
  let second = FAR;
  let best = 0;
  for (let row = rowAt - 1; row <= rowAt + 1; row += 1) {
    for (let column = columnAt - columnsBefore; column <= columnAt + columnsAfter; column += 1) {
      const index = wrap(row, rows) * columns + wrap(column, columns);
      const site = sites[index] ?? { across: 0, down: 0 };
      const offsetX = Math.abs(across - site.across);
      const offsetY = Math.abs(down - site.down);
      const apartX = Math.min(offsetX, 1 - offsetX) * stretchX;
      const apartY = Math.min(offsetY, 1 - offsetY);
      const squared = apartX * apartX + apartY * apartY;
      if (squared < nearest) {
        second = nearest;
        nearest = squared;
        best = index;
      } else if (squared < second && index !== best) second = squared;
    }
  }
  return [nearest, second, best];
}

/** The field over a `sizePx` tile, yielding every few rows. */
export function* cellField(sites: readonly CellSite[], sizePx: number): Generator<void, CellField> {
  const field: CellField = {
    sizePx,
    edge: new Float32Array(sizePx * sizePx),
    centre: new Float32Array(sizePx * sizePx),
    site: new Uint16Array(sizePx * sizePx),
  };
  for (let y = 0; y < sizePx; y += 1) {
    for (let x = 0; x < sizePx; x += 1) {
      const [nearest, second, best] = nearestSites(sites, x / sizePx, y / sizePx);
      const offset = y * sizePx + x;
      field.edge[offset] = (Math.sqrt(second) - Math.sqrt(nearest)) * sizePx;
      field.centre[offset] = Math.sqrt(nearest) * sizePx;
      field.site[offset] = best;
    }
    if (y % GEOMETRY.rowsStep === GEOMETRY.rowsStep - 1) yield;
  }
  return field;
}

const BRIGHT_RAMP = rampOf([SLIME_PALETTE.cellDark, SLIME_PALETTE.cellBase, SLIME_PALETTE.cellLight]);
const WALL = rgb255(SLIME_PALETTE.cellWall);

/** A pixel's place in its cell: px from the wall and from the site, and its cell's shade roll. */
export interface CellPixel {
  readonly edge: number;
  readonly centre: number;
  readonly shade: number;
}

/** A bright-field pixel: the cell's body, grooved inside its wall, the wall bright. */
export function brightCellColour(pixel: CellPixel, sizePx: number, out: PixelColour): void {
  const { edge, centre, shade } = pixel;
  const { shade: tone, wall: wallLook, groove: grooveLook } = SLIME_CELLS_BRIGHT;
  const body = ramp3(...BRIGHT_RAMP, clampUnit(tone.base + shade * tone.roll - (centre / sizePx) * tone.falloff));
  const wall = clampUnit(1 - edge / wallLook.px);
  const groove = clampUnit(1 - Math.abs(edge - grooveLook.atPx) / grooveLook.halfWidthPx) * grooveLook.depth;
  out.red = lerp(body[0] * (1 - groove), WALL[0], wall);
  out.green = lerp(body[1] * (1 - groove), WALL[1], wall);
  out.blue = lerp(body[2] * (1 - groove), WALL[2], wall);
  out.alpha = CHANNEL_MAX;
}

/** A dark-field pixel: the wall's glow over the dark. */
export function darkCellColour(edge: number, out: PixelColour): void {
  const { sharp, soft, glow, base } = SLIME_CELLS_DARK;
  const weight = Math.exp(-edge / sharp.px) * sharp.weight + Math.exp(-edge / soft.px) * soft.weight;
  out.red = glow[0] * weight + base[0];
  out.green = glow[1] * weight + base[1];
  out.blue = glow[2] * weight + base[2];
  out.alpha = CHANNEL_MAX;
}

function plastidFill(
  context: ShoreContext2D,
  disc: { readonly x: number; readonly y: number; readonly radius: number },
  isBright: boolean,
): void {
  const { x, y, radius } = disc;
  if (!isBright) {
    context.fillStyle = SLIME_CELL_PLASTIDS.darkColour;
    return;
  }
  const { offset, core } = SLIME_CELL_PLASTIDS.light;
  const gradient = context.createRadialGradient(x - radius * offset, y - radius * offset, radius * core, x, y, radius);
  gradient.addColorStop(0, SLIME_PALETTE.phaeoLight);
  gradient.addColorStop(1, SLIME_PALETTE.phaeo);
  context.fillStyle = gradient;
}

/** Each cell's plastids round its site and its nucleus, drawn across the seams (`plastids`). */
export function drawPlastids(canvas: ShoreCanvas, sites: readonly CellSite[], isBright: boolean): void {
  const { context, width: sizePx } = canvas;
  const { count, salts, fullTurn, reach, radius, squash, nucleus } = SLIME_CELL_PLASTIDS;
  sites.forEach((site, index) => {
    const plastids = count.min + Math.floor(site.shade * count.span);
    for (let plastid = 0; plastid < plastids; plastid += 1) {
      const angle = coordinateHash(index, plastid, salts.angle) * fullTurn;
      const along = (reach.min + coordinateHash(index, plastid, salts.reach) * reach.span) * sizePx;
      const size = (radius.min + coordinateHash(index, plastid, salts.radius) * radius.span) * sizePx;
      const place = {
        x: site.across * sizePx + Math.cos(angle) * along,
        y: site.down * sizePx + Math.sin(angle) * along,
        reach: size * DIAMETER_PER_RADIUS,
      };
      wrapDraw(sizePx, place, (x, y) => {
        plastidFill(context, { x, y, radius: size }, isBright);
        context.beginPath();
        context.ellipse(x, y, size, size * squash, angle, 0, RADIANS_PER_FULL_TURN);
        context.fill();
      });
    }
    const centre = { x: site.across * sizePx, y: site.down * sizePx, reach: sizePx * nucleus.reach };
    wrapDraw(sizePx, centre, (x, y) => {
      context.fillStyle = isBright ? nucleus.bright : nucleus.dark;
      context.beginPath();
      context.arc(x, y, sizePx * nucleus.radius, 0, RADIANS_PER_FULL_TURN);
      context.fill();
    });
  });
}

/** Both tiles, a few rows at a time: the field once, then the bright tile and the dark tile with their plastids. */
export function* bakeCellTiles(
  factory: ShoreCanvasFactory,
  sizePx: number = GEOMETRY.sizePx,
): Generator<void, { readonly bright: ShoreCanvas; readonly dark: ShoreCanvas }> {
  const sites = cellSites();
  const field = yield* cellField(sites, sizePx);
  const size = { width: sizePx, height: sizePx };
  const bright = yield* pixelBake(factory, size, (x, y, out) => {
    const offset = y * sizePx + x;
    const site = sites[field.site[offset] ?? 0];
    const pixel = { edge: field.edge[offset] ?? 0, centre: field.centre[offset] ?? 0, shade: site?.shade ?? 0 };
    brightCellColour(pixel, sizePx, out);
  });
  drawPlastids(bright, sites, true);
  yield;
  const dark = yield* pixelBake(factory, size, (x, y, out) => darkCellColour(field.edge[y * sizePx + x] ?? 0, out));
  drawPlastids(dark, sites, false);
  return { bright, dark };
}
