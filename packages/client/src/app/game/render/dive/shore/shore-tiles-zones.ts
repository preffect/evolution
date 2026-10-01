// The intertidal zones' near tiles at true scale (docs/rendering/opening-dive.md §4, ticket #801): acorn barnacles,
// rockweed, blue mussels and the low zone's coralline crust and surfgrass (the mockup's `BAKES.barnacle`, `rockweed`,
// `mussel` and `lowzone`). Each zone also has a far tile (`shore-tiles-far.ts`) whose alpha masks this one.

import { RADIANS_PER_FULL_TURN, type RandomSource } from '@evolution/shared';
import {
  SHORE_BARNACLE_TILE,
  SHORE_LOWZONE_TILE,
  SHORE_MUSSEL_TILE,
  SHORE_PALETTE,
  SHORE_SCATTER_ITEMS_PER_SLICE,
} from '../../constants/dive-shore-tiles';
import { HALF } from '../../geometry';
import { drawBarnacle } from './shore-barnacle';
import type { ShoreCanvas } from './shore-canvas';
import { shoreRandom, square } from './shore-noise';
import { clampUnit, rgb255, setColour, squarePixelBake, wrapDraw } from './shore-pixels';
import type { TileBake } from './shore-tiles-rock';

interface ScatterItem {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly roll: number;
}

function barnacleItems(kit: Parameters<TileBake>[0], random: RandomSource): ScatterItem[] {
  const tile = SHORE_BARNACLE_TILE;
  const items: ScatterItem[] = [];
  for (let item = 0; item < tile.count; item += 1) {
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const period = square(tile.clump.frequency);
    const clump = kit.noise.noise((x / tile.sizePx) * period.x, (y / tile.sizePx) * period.y, period, tile.clump.salt);
    if (clump < tile.sparseBelow && random.nextFloat() < tile.sparseKeep) continue;
    const span = tile.radiusPx.span * (tile.radiusPx.clumpBase + clump * tile.radiusPx.clumpGain);
    items.push({ x, y, radius: tile.radiusPx.min + random.nextFloat() * span, roll: random.nextFloat() });
  }
  return items.sort((first, second) => first.y - second.y);
}

/** Acorn barnacles, true scale: the tile is 0.24 m (`BAKES.barnacle`). */
export const bakeBarnacles: TileBake = function* (kit) {
  const tile = SHORE_BARNACLE_TILE;
  const canvas = kit.factory.create(tile.sizePx, tile.sizePx);
  const items = barnacleItems(kit, shoreRandom('barnacle'));
  const shells: ShoreCanvas[] = [];
  for (let shell = 0; shell < tile.shells; shell += 1) {
    const sprite = kit.factory.create(tile.spritePx, tile.spritePx);
    drawBarnacle(sprite.context, {
      x: tile.spriteCentrePx,
      y: tile.spriteCentrePx,
      radius: tile.spriteRadiusPx,
      turn: shell * tile.shellTurn,
    });
    shells.push(sprite);
  }
  let drawn = 0;
  for (const item of items) {
    drawn += 1;
    if (drawn % SHORE_SCATTER_ITEMS_PER_SLICE === 0) yield;
    const shell = shells[Math.floor(item.roll * tile.shells) % tile.shells];
    if (shell === undefined) continue;
    const scale = item.radius / tile.spriteRadiusPx;
    wrapDraw(tile.sizePx, { x: item.x, y: item.y, reach: item.radius * tile.reachRadii }, (x, y) => {
      const corner = tile.spriteCentrePx * scale;
      canvas.context.drawImage(shell.image, x - corner, y - corner, tile.spritePx * scale, tile.spritePx * scale);
    });
  }
  return canvas;
};

function drawMussel(
  canvas: ShoreCanvas,
  point: { readonly x: number; readonly y: number },
  shape: { readonly length: number; readonly angle: number },
): void {
  const tile = SHORE_MUSSEL_TILE;
  const context = canvas.context;
  const length = shape.length;
  context.save();
  context.translate(point.x, point.y);
  context.rotate(shape.angle);
  context.fillStyle = tile.shadow.colour;
  context.beginPath();
  context.ellipse(
    tile.shadow.x,
    tile.shadow.y,
    length * tile.shadow.radiusX,
    length * tile.shadow.radiusY,
    0,
    0,
    RADIANS_PER_FULL_TURN,
  );
  context.fill();
  drawShell(canvas, length);
  context.restore();
}

/** A mussel's shell along +x at the origin, `length` long: its blue-black sheen and the light along its back. */
function drawShell(canvas: ShoreCanvas, length: number): void {
  const tile = SHORE_MUSSEL_TILE;
  const context = canvas.context;
  const gradient = context.createLinearGradient(0, -length * tile.shell.top, 0, length * tile.shell.top);
  gradient.addColorStop(0, SHORE_PALETTE.musselSheen);
  gradient.addColorStop(tile.sheenStop, tile.shellMid);
  gradient.addColorStop(1, SHORE_PALETTE.musselDark);
  context.fillStyle = gradient;
  context.beginPath();
  const outline = tile.shell;
  context.moveTo(-length * HALF, 0);
  context.quadraticCurveTo(-length * outline.backX, -length * outline.backY, length * HALF, -length * outline.tipY);
  context.quadraticCurveTo(length * outline.bellyX, length * outline.backY, -length * HALF, 0);
  context.fill();
  context.strokeStyle = tile.sheen.colour;
  context.lineWidth = tile.sheen.widthPx;
  context.beginPath();
  const line = tile.sheenLine;
  context.moveTo(-length * line.fromX, -length * line.fromY);
  context.quadraticCurveTo(0, -length * line.controlY, length * line.toX, -length * line.toY);
  context.stroke();
}

/** Blue mussels in clumps, true scale: the tile is 0.5 m (`BAKES.mussel`). */
export const bakeMussels: TileBake = function* (kit) {
  const tile = SHORE_MUSSEL_TILE;
  const canvas = kit.factory.create(tile.sizePx, tile.sizePx);
  const random = shoreRandom('mussel');
  const period = square(tile.clump.frequency);
  for (let item = 0; item < tile.count; item += 1) {
    if (item % SHORE_SCATTER_ITEMS_PER_SLICE === SHORE_SCATTER_ITEMS_PER_SLICE - 1) yield;
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    if (
      kit.noise.noise((x / tile.sizePx) * period.x, (y / tile.sizePx) * period.y, period, tile.clump.salt) <
      tile.keepAbove
    )
      continue;
    const length = tile.lengthPx.min + random.nextFloat() * tile.lengthPx.span;
    const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
    wrapDraw(tile.sizePx, { x, y, reach: length }, (atX, atY) =>
      drawMussel(canvas, { x: atX, y: atY }, { length, angle }),
    );
  }
  return canvas;
};

function drawSurfgrass(canvas: ShoreCanvas, random: RandomSource, noise: Parameters<TileBake>[0]['noise']): void {
  const tile = SHORE_LOWZONE_TILE;
  const grass = tile.grass;
  const context = canvas.context;
  const period = square(grass.frequency);
  context.lineCap = 'round';
  for (let blade = 0; blade < grass.count; blade += 1) {
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    if (noise.noise((x / tile.sizePx) * period.x, (y / tile.sizePx) * period.y, period, grass.salt) < grass.keepAbove)
      continue;
    const angle = grass.angle + (random.nextFloat() - HALF) * grass.angleSpan;
    const length = grass.lengthPx.min + random.nextFloat() * grass.lengthPx.span;
    const colour = random.nextFloat() < HALF ? SHORE_PALETTE.surfgrass : tile.grassBright;
    wrapDraw(tile.sizePx, { x, y, reach: length }, (atX, atY) => {
      context.strokeStyle = colour;
      context.lineWidth = tile.grassWidthPx;
      context.beginPath();
      context.moveTo(atX, atY);
      const controlX = atX + Math.cos(angle) * length * HALF + tile.grassBendPx;
      context.quadraticCurveTo(
        controlX,
        atY + Math.sin(angle) * length * HALF,
        atX + Math.cos(angle) * length,
        atY + Math.sin(angle) * length,
      );
      context.stroke();
    });
  }
}

/** The low zone: pink coralline crusts and bright surfgrass, true scale: the tile is 0.7 m (`BAKES.lowzone`). */
export const bakeLowZone: TileBake = function* (kit) {
  const tile = SHORE_LOWZONE_TILE;
  const pink = rgb255(SHORE_PALETTE.coralline);
  const light = rgb255(SHORE_PALETTE.corallineLight);
  const canvas = yield* squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const across = x / tile.sizePx;
    const down = y / tile.sizePx;
    const crust = kit.noise.fbm({ across, down }, square(tile.crust.frequency), tile.crust.octaves, tile.crust.salt);
    const mottle = kit.noise.fbm(
      { across, down },
      square(tile.mottle.frequency),
      tile.mottle.octaves,
      tile.mottle.salt,
    );
    const alpha = clampUnit((crust - tile.coverFrom) * tile.coverGain) * tile.alpha;
    const mixed: [number, number, number] = [0, 0, 0];
    for (let channel = 0; channel < mixed.length; channel += 1) {
      mixed[channel] = (pink[channel] ?? 0) + ((light[channel] ?? 0) - (pink[channel] ?? 0)) * mottle;
    }
    setColour(out, mixed, alpha);
  });
  drawSurfgrass(canvas, shoreRandom('lowzone'), kit.noise);
  return canvas;
};
