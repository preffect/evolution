// The shore's stone tiles (docs/rendering/opening-dive.md §4, ticket #801): bedrock, its crystals and the black tar
// lichen of the splash zone. Self-similar, so the shore draws each at two neighbouring octaves (`shore-paint.ts`).

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SHORE_GRAIN_TILE, SHORE_LICHEN_TILE, SHORE_PALETTE, SHORE_ROCK_TILE } from '../../constants/dive-shore-tiles';
import { HALF } from '../../geometry';
import type { ShoreCanvas, ShoreCanvasFactory } from './shore-canvas';
import { coordinateHash, shoreRandom, square, type PeriodicNoise } from './shore-noise';
import { clampUnit, ramp3, rgb255, setColour, squarePixelBake, wrapDraw, type PixelColour } from './shore-pixels';

/** What every tile bake draws with. */
export interface TileBakeKit {
  readonly factory: ShoreCanvasFactory;
  readonly noise: PeriodicNoise;
}

export type TileBake = (kit: TileBakeKit) => Generator<void, ShoreCanvas>;

const UNBOUNDED_REACH = Number.MAX_VALUE;

function rockShade(noise: PeriodicNoise): (x: number, y: number, out: PixelColour) => void {
  const tile = SHORE_ROCK_TILE;
  const dark = rgb255(SHORE_PALETTE.rockDark);
  const base = rgb255(SHORE_PALETTE.rockBase);
  const light = rgb255(SHORE_PALETTE.rockLight);
  return (x, y, out) => {
    const across = x / tile.sizePx;
    const down = y / tile.sizePx;
    const broad = noise.fbm({ across, down }, square(tile.base.frequency), tile.base.octaves, tile.base.salt);
    const fine = noise.fbm({ across, down }, square(tile.fine.frequency), tile.fine.octaves, tile.fine.salt);
    let value = clampUnit((broad - HALF) * tile.contrast + HALF) * tile.baseShare + fine * tile.fineShare;
    const speck = coordinateHash(x, y, tile.speckSalt);
    if (speck > tile.darkSpeckAbove) value -= tile.darkSpeck;
    else if (speck < tile.lightSpeckBelow) value += tile.lightSpeck;
    setColour(out, ramp3(dark, base, light, clampUnit(value)));
  };
}

/** A crack's wandering path across the tile, from the bake's own stream. */
function crackPath(random: () => number): readonly (readonly [number, number])[] {
  const cracks = SHORE_ROCK_TILE.cracks;
  let x = random() * SHORE_ROCK_TILE.sizePx;
  let y = random() * SHORE_ROCK_TILE.sizePx;
  let angle = random() * RADIANS_PER_FULL_TURN;
  const points: [number, number][] = [[x, y]];
  for (let step = 0; step < cracks.steps; step += 1) {
    angle += (random() - HALF) * cracks.wander;
    x += Math.cos(angle) * cracks.stepPx;
    y += Math.sin(angle) * cracks.stepPx;
    points.push([x, y]);
  }
  return points;
}

function strokeCrack(
  canvas: ShoreCanvas,
  points: readonly (readonly [number, number])[],
  offset: readonly [number, number],
): void {
  const context = canvas.context;
  const [offsetX, offsetY] = offset;
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x + offsetX, y + offsetY);
    else context.lineTo(x + offsetX, y + offsetY);
  });
  context.strokeStyle = SHORE_ROCK_TILE.crackShadow.colour;
  context.lineWidth = SHORE_ROCK_TILE.crackShadow.widthPx;
  context.stroke();
  const light = SHORE_ROCK_TILE.crackLight;
  context.translate(light.offsetPx, light.offsetPx);
  context.strokeStyle = light.colour;
  context.lineWidth = light.widthPx;
  context.stroke();
  context.translate(-light.offsetPx, -light.offsetPx);
}

/** Bedrock: diorite and greenstone, glacially smoothed, speckled, cracked (`BAKES.rock`). */
export const bakeRock: TileBake = function* (kit) {
  const canvas = yield* squarePixelBake(kit.factory, SHORE_ROCK_TILE.sizePx, rockShade(kit.noise));
  const random = shoreRandom(SHORE_ROCK_TILE.cracks.salt);
  const next = (): number => random.nextFloat();
  canvas.context.lineCap = 'round';
  for (let crack = 0; crack < SHORE_ROCK_TILE.cracks.count; crack += 1) {
    const points = crackPath(next);
    wrapDraw(SHORE_ROCK_TILE.sizePx, { x: 0, y: 0, reach: UNBOUNDED_REACH }, (x, y) =>
      strokeCrack(canvas, points, [x, y]),
    );
  }
  return canvas;
};

function grainColour(roll: number): string {
  const colours = SHORE_GRAIN_TILE.colours;
  if (roll < SHORE_GRAIN_TILE.darkBelow) return colours.dark;
  return roll < SHORE_GRAIN_TILE.paleBelow ? colours.pale : colours.warm;
}

/** Crystals in the stone: dark grains, pale feldspar, a few glints, on transparent (`BAKES.grain`). */
export const bakeGrain: TileBake = function* (kit) {
  const tile = SHORE_GRAIN_TILE;
  const canvas = kit.factory.create(tile.sizePx, tile.sizePx);
  const context = canvas.context;
  const random = shoreRandom('grain');
  for (let grain = 0; grain < tile.count; grain += 1) {
    if (grain % tile.perSlice === tile.perSlice - 1) yield;
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const roll = random.nextFloat();
    const radius = tile.radiusPx.min + random.nextFloat() * random.nextFloat() * tile.radiusPx.span;
    const angle = random.nextFloat() * Math.PI;
    context.fillStyle = grainColour(roll);
    wrapDraw(tile.sizePx, { x, y, reach: radius * tile.reachRadii }, (atX, atY) => {
      context.beginPath();
      context.ellipse(atX, atY, radius * tile.stretch, radius, angle, 0, RADIANS_PER_FULL_TURN);
      context.fill();
    });
  }
  return canvas;
};

/** Black tar lichen of the splash zone: mottled, with holes that let the rock through (`BAKES.lichenBlack`). */
export const bakeLichen: TileBake = (kit) => {
  const tile = SHORE_LICHEN_TILE;
  const [red, green, blue] = rgb255(SHORE_PALETTE.lichenBlack);
  const [mottleRed, mottleGreen, mottleBlue] = tile.mottleRgb;
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const across = x / tile.sizePx;
    const down = y / tile.sizePx;
    const cover = kit.noise.fbm({ across, down }, square(tile.cover.frequency), tile.cover.octaves, tile.cover.salt);
    const mottle = kit.noise.fbm(
      { across, down },
      square(tile.mottle.frequency),
      tile.mottle.octaves,
      tile.mottle.salt,
    );
    const alpha = clampUnit((cover - tile.coverFrom) * tile.coverGain) * (tile.alphaBase + mottle * tile.alphaMottle);
    setColour(out, [red + mottle * mottleRed, green + mottle * mottleGreen, blue + mottle * mottleBlue], alpha);
  });
};
