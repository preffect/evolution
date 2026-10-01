// The shore's water tiles (docs/rendering/opening-dive.md §4, ticket #801): pocket-beach sand, the wind ripples and
// the swell (neutral grey, for soft-light), sun glints, lacy foam and the caustic net on the floor (the mockup's
// `BAKES.sand`, `ripple`, `swell`, `glint`, `foam` and `caustic`). The ripples, swell, glints, foam and caustics also
// go to the GPU as the live sea's textures (`shore-sea-shader.ts`).

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  SHORE_CAUSTIC_TILE,
  SHORE_FOAM_TILE,
  SHORE_GLINT_TILE,
  SHORE_RIPPLE_TILE,
  SHORE_SAND_TILE,
  SHORE_SWELL_TILE,
} from '../../constants/dive-shore-sea-tiles';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { CHANNEL_MAX } from '../../colour';
import { DIAMETER_PER_RADIUS, HALF } from '../../geometry';
import { coordinateHash, shoreRandom, square, wrappingVoronoi, type PeriodicNoise } from './shore-noise';
import { clampUnit, ramp3, rgb255, setColour, squarePixelBake, wrapDraw } from './shore-pixels';
import type { TileBake } from './shore-tiles-rock';

function speckLift(roll: number): number {
  const tile = SHORE_SAND_TILE;
  if (roll > tile.lightAbove) return tile.light;
  return roll < tile.darkBelow ? -tile.dark : 0;
}

/** Sand and fine gravel of a pocket beach (`BAKES.sand`). */
export const bakeSand: TileBake = (kit) => {
  const tile = SHORE_SAND_TILE;
  const wet = rgb255(SHORE_PALETTE.sandWet);
  const base = rgb255(SHORE_PALETTE.sandBase);
  const light = rgb255(SHORE_PALETTE.sandLight);
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const grain = kit.noise.fbm(
      { across: x / tile.sizePx, down: y / tile.sizePx },
      square(tile.grain.frequency),
      tile.grain.octaves,
      tile.grain.salt,
    );
    const tone = grain * tile.share + tile.lift + speckLift(coordinateHash(x, y, tile.speckSalt));
    setColour(out, ramp3(wet, base, light, clampUnit(tone)));
  });
};

function grey(value: number): readonly [number, number, number] {
  return [value, value, value];
}

/** Wind ripples on the water, neutral grey for soft-light (`BAKES.ripple`). */
export const bakeRipples: TileBake = (kit) => {
  const tile = SHORE_RIPPLE_TILE;
  const { first, second, third } = tile;
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const across = (x / tile.sizePx) * RADIANS_PER_FULL_TURN;
    const down = (y / tile.sizePx) * RADIANS_PER_FULL_TURN;
    const roughness = kit.noise.fbm(
      { across: x / tile.sizePx, down: y / tile.sizePx },
      square(tile.roughness.frequency),
      tile.roughness.octaves,
      tile.roughness.salt,
    );
    const height =
      Math.sin(across * first.u + down * first.v + first.warp * Math.sin(down * first.warpFrequency)) * first.weight +
      Math.sin(across * second.u + down * second.v + second.phase) * second.weight +
      Math.sin(across * third.u + down * third.v + third.warp * Math.sin(across * third.warpFrequency)) * third.weight +
      (roughness - HALF) * tile.roughness.gain;
    setColour(out, grey(tile.grey + height * tile.amplitude));
  });
};

/** The long swell from the open strait: soft crests, neutral grey for soft-light; the tile is 90 m (`BAKES.swell`). */
export const bakeSwell: TileBake = (kit) => {
  const tile = SHORE_SWELL_TILE;
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const across = x / tile.sizePx;
    const down = y / tile.sizePx;
    const warp = kit.noise.fbm({ across, down }, square(tile.warp.frequency), tile.warp.octaves, tile.warp.salt);
    const chop = kit.noise.fbm({ across, down }, square(tile.chop.frequency), tile.chop.octaves, tile.chop.salt);
    const { long, short } = tile;
    const height =
      Math.sin((down * long.v + across * long.u + warp * long.warp) * RADIANS_PER_FULL_TURN) * long.weight +
      Math.sin((down * short.v + across * short.u + warp * short.warp) * RADIANS_PER_FULL_TURN) * short.weight +
      (chop - HALF) * tile.chop.weight;
    setColour(out, grey(tile.grey + height * tile.amplitude));
  });
};

/** Sun glints: sparse bright specks, added with `lighter` and drifting against the ripples (`BAKES.glint`). */
export const bakeGlints: TileBake = function* (kit) {
  const tile = SHORE_GLINT_TILE;
  const canvas = kit.factory.create(tile.sizePx, tile.sizePx);
  const context = canvas.context;
  const random = shoreRandom('glint');
  for (let glint = 0; glint < tile.count; glint += 1) {
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const radius = tile.radiusPx.min + random.nextFloat() * tile.radiusPx.span;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius * tile.glowRadii);
    gradient.addColorStop(0, tile.core);
    gradient.addColorStop(1, tile.rim);
    context.fillStyle = gradient;
    const box = radius * tile.boxRadii;
    context.fillRect(x - box, y - box, box * DIAMETER_PER_RADIUS, box * DIAMETER_PER_RADIUS);
  }
  yield;
  return canvas;
};

interface WarpRecipe {
  readonly frequency: number;
  readonly octaves: number;
  readonly saltU: number;
  readonly saltV: number;
  readonly offsetU: number;
  readonly amount: number;
}

/** The tile coordinates nudged by two slow noises, so a Voronoi net reads as organic filaments, not a mesh. */
function warped(
  noise: PeriodicNoise,
  point: { readonly across: number; readonly down: number },
  warp: WarpRecipe,
): { across: number; down: number } {
  const period = square(warp.frequency);
  const across = point.across + (noise.fbm(point, period, warp.octaves, warp.saltU) - HALF) * warp.amount;
  const down =
    point.down +
    (noise.fbm({ across: across + warp.offsetU / warp.frequency, down: point.down }, period, warp.octaves, warp.saltV) -
      HALF) *
      warp.amount;
  return { across, down };
}

function squared(value: number): number {
  return value * value;
}

function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1;
}

function siteJitter(salt: number, jitter: { readonly scale: number; readonly offset: number }) {
  return (cellX: number, cellY: number, axis: number): number =>
    coordinateHash(cellX, cellY, salt + axis) * jitter.scale + jitter.offset;
}

/** The foam's bubbles: loose rings over the sheet. */
function drawBubbles(canvas: ReturnType<Parameters<TileBake>[0]['factory']['create']>): void {
  const tile = SHORE_FOAM_TILE;
  const bubbles = tile.bubbles;
  const context = canvas.context;
  const random = shoreRandom('foam');
  for (let bubble = 0; bubble < bubbles.count; bubble += 1) {
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const radius = bubbles.radiusPx.min + random.nextFloat() * bubbles.radiusPx.span;
    wrapDraw(tile.sizePx, { x, y, reach: radius + 1 }, (atX, atY) => {
      context.strokeStyle = bubbles.colour;
      context.lineWidth = bubbles.widthPx;
      context.beginPath();
      context.arc(atX, atY, radius, 0, RADIANS_PER_FULL_TURN);
      context.stroke();
    });
  }
}

/** Lacy sea foam: a white sheet torn into holes, streaked, with loose bubbles; the tile is 2.4 m (`BAKES.foam`). */
export const bakeFoam: TileBake = function* (kit) {
  const tile = SHORE_FOAM_TILE;
  const jitter = siteJitter(tile.jitterSalt, tile.jitter);
  const canvas = yield* squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const point = warped(kit.noise, { across: x / tile.sizePx, down: y / tile.sizePx }, tile.warp);
    const cells = wrappingVoronoi(wrapUnit(point.across), wrapUnit(point.down), tile.grid, jitter);
    const edge = (cells.second - cells.nearest) * tile.grid;
    const sheet = kit.noise.fbm(point, square(tile.sheet.frequency), tile.sheet.octaves, tile.sheet.salt);
    const hole = clampUnit((edge - tile.edgeFrom) / tile.edgeSpan) * clampUnit((sheet - tile.holeFrom) * tile.holeGain);
    const alpha = clampUnit(1 - hole) * clampUnit((sheet - tile.sheetFrom) * tile.sheetGain);
    setColour(out, tile.rgb, alpha * tile.alpha);
  });
  drawBubbles(canvas);
  return canvas;
};

/** The caustic net the sun throws on a shallow floor (`BAKES.caustic`): bright where the filaments converge. */
export const bakeCaustic: TileBake = (kit) => {
  const tile = SHORE_CAUSTIC_TILE;
  const jitter = siteJitter(tile.jitterSalt, tile.jitter);
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const point = warped(kit.noise, { across: x / tile.sizePx, down: y / tile.sizePx }, tile.warp);
    const cells = wrappingVoronoi(wrapUnit(point.across), wrapUnit(point.down), tile.grid, jitter);
    const edge = (cells.second - cells.nearest) * tile.grid;
    const light =
      tile.light.base +
      tile.light.gain * kit.noise.fbm(point, square(tile.light.frequency), tile.light.octaves, tile.light.salt);
    const sharp = squared(clampUnit(1 - edge / tile.sharp.width)) * tile.sharp.weight;
    const soft = squared(clampUnit(1 - edge / tile.soft.width)) * tile.soft.weight;
    setColour(out, tile.rgb, clampUnit((sharp + soft) * light) * CHANNEL_MAX);
  });
};
