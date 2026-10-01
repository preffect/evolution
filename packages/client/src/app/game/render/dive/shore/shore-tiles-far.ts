// The intertidal zones seen from farther off (docs/rendering/opening-dive.md §4, ticket #801, the mockup's
// `BAKES.<zone>Far` and `patch`): each zone's own bake at a larger true size, kept only in slow-noise patches so the
// zone reads as a mosaic, not a stripe of paint. Its alpha doubles as the patch mask for the near tile (`zoneFill`).

import {
  SHORE_BARNACLE_FAR_TILE,
  SHORE_LOWZONE_FAR_TILE,
  SHORE_MUSSEL_FAR_TILE,
  SHORE_PATCH,
  SHORE_ROCKWEED_FAR_TILE,
} from '../../constants/dive-shore-far-tiles';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { BLUE, GREEN, RED } from '../../colour';
import { HALF } from '../../geometry';
import { coordinateHash, square, type PeriodicNoise } from './shore-noise';
import { clampUnit, ramp3, rgb255, setColour, squarePixelBake, type Rgb255 } from './shore-pixels';
import type { TileBake } from './shore-tiles-rock';

/** The slow-noise patch a far tile keeps (`patch(across, down, seed, cover)`): 1 inside, 0 outside, a soft edge between. */
function patchAt(
  noise: PeriodicNoise,
  point: { readonly across: number; readonly down: number },
  salt: number,
  cover: number,
): number {
  const value = noise.fbm(point, square(SHORE_PATCH.frequency), SHORE_PATCH.octaves, salt);
  return clampUnit((value - (1 - cover)) * SHORE_PATCH.gain + HALF);
}

function lerpRgb(from: Rgb255, target: Rgb255, fraction: number): Rgb255 {
  return [
    from[RED] + (target[RED] - from[RED]) * fraction,
    from[GREEN] + (target[GREEN] - from[GREEN]) * fraction,
    from[BLUE] + (target[BLUE] - from[BLUE]) * fraction,
  ];
}

/** Barnacles from afar (`BAKES.barnacleFar`). */
export const bakeBarnaclesFar: TileBake = (kit) => {
  const tile = SHORE_BARNACLE_FAR_TILE;
  const light = rgb255(SHORE_PALETTE.barnacleLight);
  const base = rgb255(SHORE_PALETTE.barnacleBase);
  const dark = rgb255(SHORE_PALETTE.barnacleDark);
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const point = { across: x / tile.sizePx, down: y / tile.sizePx };
    const cover = patchAt(kit.noise, point, tile.patchSalt, tile.cover);
    const grain = kit.noise.fbm(point, square(tile.grain.frequency), tile.grain.octaves, tile.grain.salt);
    const isBareSpeck = coordinateHash(x, y, tile.speckSalt) > tile.speckAbove;
    const colour = isBareSpeck ? base : ramp3(dark, base, light, clampUnit(grain * tile.grainShare + tile.grainLift));
    setColour(out, colour, cover * tile.alpha);
  });
};

/** Mussels from afar (`BAKES.musselFar`). */
export const bakeMusselsFar: TileBake = (kit) => {
  const tile = SHORE_MUSSEL_FAR_TILE;
  const dark = rgb255(SHORE_PALETTE.musselDark);
  const sheen = rgb255(SHORE_PALETTE.musselSheen);
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const across = x / tile.sizePx;
    const down = y / tile.sizePx;
    const coverNoise = kit.noise.fbm(
      { across, down },
      square(tile.cover.frequency),
      tile.cover.octaves,
      tile.cover.salt,
    );
    const cover = clampUnit((coverNoise - tile.cover.from) * tile.cover.gain);
    const grain = kit.noise.fbm({ across, down }, square(tile.grain.frequency), tile.grain.octaves, tile.grain.salt);
    const glint = coordinateHash(x, y, tile.sheenSalt) > tile.sheenAbove ? tile.sheen : 0;
    setColour(out, lerpRgb(dark, sheen, grain * tile.grain.share + glint), cover * tile.alpha);
  });
};

/** Rockweed mats from afar: strands lying downslope (the tile's y runs toward the sea), golden at the tips. */
export const bakeRockweedFar: TileBake = (kit) => {
  const tile = SHORE_ROCKWEED_FAR_TILE;
  const dark = rgb255(SHORE_PALETTE.rockweedDark);
  const base = rgb255(SHORE_PALETTE.rockweedBase);
  const light = rgb255(SHORE_PALETTE.rockweedLight);
  const strandFrequency = { x: tile.strands.u, y: tile.strands.v };
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const point = { across: x / tile.sizePx, down: y / tile.sizePx };
    const cover = patchAt(kit.noise, point, tile.patchSalt, tile.cover);
    const warp = kit.noise.fbm(point, square(tile.warp.frequency), tile.warp.octaves, tile.warp.salt);
    const warpedU = point.across + (warp * tile.warp.gain) / tile.strands.u;
    const strand = kit.noise.fbm(
      { across: warpedU, down: point.down },
      strandFrequency,
      tile.strands.octaves,
      tile.strands.salt,
    );
    const clump = kit.noise.fbm(point, square(tile.clumps.frequency), tile.clumps.octaves, tile.clumps.salt);
    const glint = coordinateHash(x, y, tile.glintSalt) > tile.glintAbove ? tile.glint : 0;
    const tone = (strand - HALF) * tile.strandContrast + tile.strandLift + clump * tile.clumpShare + glint;
    const clumpAlpha = clampUnit((clump - tile.clumpFrom) * tile.clumpGain);
    setColour(out, ramp3(dark, base, light, clampUnit(tone)), cover * clumpAlpha * tile.alpha);
  });
};

function lowZoneFarColour(
  kit: Parameters<TileBake>[0],
  point: { readonly across: number; readonly down: number },
): { colour: Rgb255; isPink: boolean; grass: number } {
  const tile = SHORE_LOWZONE_FAR_TILE;
  const grass = kit.noise.fbm(point, { x: tile.grass.u, y: tile.grass.v }, tile.grass.octaves, tile.grass.salt);
  const pinkNoise = kit.noise.fbm(point, square(tile.pink.frequency), tile.pink.octaves, tile.pink.salt);
  if (pinkNoise > tile.pink.above) {
    const grain = kit.noise.fbm(point, square(tile.pinkGrain.frequency), tile.pinkGrain.octaves, tile.pinkGrain.salt);
    const pink = rgb255(SHORE_PALETTE.coralline);
    return {
      colour: ramp3(pink, pink, rgb255(SHORE_PALETTE.corallineLight), grain * tile.pinkGrain.share),
      isPink: true,
      grass,
    };
  }
  const green = rgb255(SHORE_PALETTE.surfgrass);
  const shade = tile.grassShade;
  const colour: Rgb255 = [
    green[RED] * (shade.base + grass * shade.gain),
    green[GREEN] * (shade.base + grass * shade.gain),
    green[BLUE] * (shade.blueBase + grass * shade.blueGain),
  ];
  return { colour, isPink: false, grass };
}

/** The low zone from afar: bright surfgrass streaks and pink coralline crust (`BAKES.lowzoneFar`). */
export const bakeLowZoneFar: TileBake = (kit) => {
  const tile = SHORE_LOWZONE_FAR_TILE;
  return squarePixelBake(kit.factory, tile.sizePx, (x, y, out) => {
    const point = { across: x / tile.sizePx, down: y / tile.sizePx };
    const cover = patchAt(kit.noise, point, tile.patchSalt, tile.cover);
    const { colour, isPink, grass } = lowZoneFarColour(kit, point);
    const [liftRed, liftGreen, liftBlue] = tile.lift;
    const dimmed: Rgb255 = [
      colour[RED] * tile.dim + liftRed,
      colour[GREEN] * tile.dim + liftGreen,
      colour[BLUE] * tile.dim + liftBlue,
    ];
    const grassAlpha = clampUnit(grass * tile.grassAlphaGain - tile.grassAlphaFrom) * tile.grassAlpha;
    setColour(out, dimmed, cover * (isPink ? tile.pinkAlpha : grassAlpha));
  });
};
