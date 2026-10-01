// The shallow sea's floor and canopy tiles (docs/rendering/opening-dive.md §4, ticket #801): the sea floor through the
// shallows, and the bull kelp canopy seen from above, near and far (the mockup's `BAKES.seabed`, `kelpbed` and
// `kelpbedFar`).

import { RADIANS_PER_FULL_TURN, type RandomSource } from '@evolution/shared';
import { SHORE_KELPBED_FAR_TILE, SHORE_KELPBED_TILE, SHORE_SEABED_TILE } from '../../constants/dive-shore-sea-tiles';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { HALF } from '../../geometry';
import type { ShoreCanvas } from './shore-canvas';
import { shoreRandom, square, type PeriodicNoise } from './shore-noise';
import { clampUnit, ramp3, rgb255, setColour, squarePixelBake, wrapDraw } from './shore-pixels';
import type { TileBake } from './shore-tiles-rock';

const MIDDLE_BLADE = 2;

function drawKelpPlant(
  canvas: ShoreCanvas,
  point: { readonly x: number; readonly y: number },
  plant: { readonly angle: number; readonly lengths: readonly number[] },
): void {
  const tile = SHORE_KELPBED_TILE;
  const pxPerM = tile.sizePx / tile.tileM;
  const context = canvas.context;
  plant.lengths.forEach((length, blade) => {
    const angle = plant.angle + (blade - MIDDLE_BLADE) * tile.bladeFan;
    context.strokeStyle = tile.bladeColours[blade % tile.bladeColours.length] ?? '';
    context.lineWidth = tile.bladeWidthM * pxPerM;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.quadraticCurveTo(
      point.x + Math.cos(angle) * length * HALF + tile.bendPx,
      point.y + Math.sin(angle) * length * HALF - tile.bendPx,
      point.x + Math.cos(angle) * length,
      point.y + Math.sin(angle) * length,
    );
    context.stroke();
  });
  context.fillStyle = SHORE_PALETTE.kelpDark;
  context.beginPath();
  const shadow = tile.bulbShadowOffsetPx;
  context.arc(point.x + shadow, point.y + shadow, tile.bulbShadowRadiusM * pxPerM, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  context.fillStyle = SHORE_PALETTE.kelpLight;
  context.beginPath();
  context.arc(point.x, point.y, tile.bulbRadiusM * pxPerM, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

/** A bull kelp canopy seen from above: bulbs trailing blades down-current; the tile is 24 m (`BAKES.kelpbed`). */
export const bakeKelpBed: TileBake = function* (kit) {
  const tile = SHORE_KELPBED_TILE;
  const pxPerM = tile.sizePx / tile.tileM;
  const canvas = kit.factory.create(tile.sizePx, tile.sizePx);
  const random = shoreRandom('kelpbed');
  canvas.context.lineCap = 'round';
  for (let plant = 0; plant < tile.count; plant += 1) {
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const angle = tile.angle + (random.nextFloat() - HALF) * tile.angleSpan;
    const lengths = Array.from(
      { length: tile.blades },
      () => (tile.bladeLengthM.min + random.nextFloat() * tile.bladeLengthM.span) * pxPerM,
    );
    wrapDraw(tile.sizePx, { x, y, reach: tile.reachM * pxPerM }, (atX, atY) =>
      drawKelpPlant(canvas, { x: atX, y: atY }, { angle, lengths }),
    );
  }
  yield;
  return canvas;
};

/** A kelp canopy seen from far off: mottled golden-brown clumps; the tile is 150 m (`BAKES.kelpbedFar`). */
export const bakeKelpBedFar: TileBake = (kit) => {
  const tile = SHORE_KELPBED_FAR_TILE;
  const [dark, base, light] = tile.ramp.map(rgb255) as [
    ReturnType<typeof rgb255>,
    ReturnType<typeof rgb255>,
    ReturnType<typeof rgb255>,
  ];
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
    const colour = ramp3(dark, base, light, clampUnit(mottle * tile.mottle.share + tile.mottle.lift));
    setColour(out, colour, clampUnit((cover - tile.cover.from) * tile.cover.gain) * tile.alpha);
  });
};

/** One cobble: its shadow, then the stone lit from the top-left. */
function drawCobble(
  canvas: ShoreCanvas,
  centre: { readonly x: number; readonly y: number },
  stone: { readonly radius: number; readonly turn: number },
): void {
  const cobbles = SHORE_SEABED_TILE.cobbles;
  const context = canvas.context;
  const { x, y } = centre;
  const { radius, turn } = stone;
  context.fillStyle = cobbles.shadow.colour;
  context.beginPath();
  context.ellipse(
    x + radius * cobbles.shadow.x,
    y + radius * cobbles.shadow.y,
    radius,
    radius * cobbles.squash,
    turn,
    0,
    RADIANS_PER_FULL_TURN,
  );
  context.fill();
  const light = cobbles.light;
  const gradient = context.createRadialGradient(
    x + radius * light.x,
    y + radius * light.y,
    radius * light.inner,
    x,
    y,
    radius,
  );
  gradient.addColorStop(0, cobbles.ramp[0]);
  gradient.addColorStop(light.midStop, cobbles.ramp[1]);
  gradient.addColorStop(1, cobbles.ramp[2]);
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(x, y, radius, radius * cobbles.squash, turn, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

function drawCobbles(canvas: ShoreCanvas, random: RandomSource, noise: PeriodicNoise): void {
  const tile = SHORE_SEABED_TILE;
  const cobbles = tile.cobbles;
  const period = square(cobbles.patch.frequency);
  for (let cobble = 0; cobble < cobbles.count; cobble += 1) {
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const radius = cobbles.radiusPx.min + random.nextFloat() * cobbles.radiusPx.span;
    const turn = random.nextFloat();
    const patch = noise.noise((x / tile.sizePx) * period.x, (y / tile.sizePx) * period.y, period, cobbles.patch.salt);
    if (patch < cobbles.patch.keepAbove) continue;
    wrapDraw(tile.sizePx, { x, y, reach: radius * cobbles.reachRadii }, (atX, atY) =>
      drawCobble(canvas, { x: atX, y: atY }, { radius, turn }),
    );
  }
}

function drawTufts(canvas: ShoreCanvas, random: RandomSource): void {
  const tile = SHORE_SEABED_TILE;
  const tufts = tile.tufts;
  const context = canvas.context;
  for (let tuft = 0; tuft < tufts.count; tuft += 1) {
    const x = random.nextFloat() * tile.sizePx;
    const y = random.nextFloat() * tile.sizePx;
    const colour = random.nextFloat() < HALF ? tufts.colours[0] : tufts.colours[1];
    const blades = Array.from({ length: tufts.blades }, () => ({
      angle: random.nextFloat() * RADIANS_PER_FULL_TURN,
      length: tufts.lengthPx.min + random.nextFloat() * tufts.lengthPx.span,
    }));
    wrapDraw(tile.sizePx, { x, y, reach: tufts.reachPx }, (atX, atY) => {
      context.strokeStyle = colour;
      context.lineWidth = tufts.widthPx;
      context.lineCap = 'round';
      context.beginPath();
      for (const { angle, length } of blades) {
        context.moveTo(atX, atY);
        context.quadraticCurveTo(
          atX + Math.cos(angle) * length * tufts.bend + tufts.bendPx,
          atY + Math.sin(angle) * length * tufts.bend,
          atX + Math.cos(angle) * length,
          atY + Math.sin(angle) * length,
        );
      }
      context.stroke();
    });
  }
}

/** The shallow sea floor: sand with ripple marks, cobbles, weed tufts; the tile is 5 m (`BAKES.seabed`). */
export const bakeSeabed: TileBake = function* (kit) {
  const tile = SHORE_SEABED_TILE;
  const [dark, base, light] = tile.ramp.map(rgb255) as [
    ReturnType<typeof rgb255>,
    ReturnType<typeof rgb255>,
    ReturnType<typeof rgb255>,
  ];
  const canvas = yield* squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const across = x / tile.sizePx;
    const down = y / tile.sizePx;
    const warp = kit.noise.fbm(
      { across, down },
      square(tile.rippleWarp.frequency),
      tile.rippleWarp.octaves,
      tile.rippleWarp.salt,
    );
    const ripple =
      Math.sin((across * tile.ripple.u + down * tile.ripple.v + warp * tile.rippleWarp.gain) * RADIANS_PER_FULL_TURN) *
        HALF +
      HALF;
    const floor = kit.noise.fbm({ across, down }, square(tile.floor.frequency), tile.floor.octaves, tile.floor.salt);
    setColour(out, ramp3(dark, base, light, clampUnit(floor * tile.floorShare + ripple * tile.rippleShare)));
  });
  const random = shoreRandom('seabed');
  drawCobbles(canvas, random, kit.noise);
  drawTufts(canvas, random);
  return canvas;
};
