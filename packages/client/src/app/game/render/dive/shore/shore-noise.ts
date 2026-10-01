// The shore's noise (docs/rendering/opening-dive.md §4, ticket #801): the mockup's coordinate hash and value noise,
// which place every beach, pool, boulder and kelp bed in the world, and its periodic lattice noise, which the tile
// bakes are drawn from so each tile wraps. The hash is a pure function of its integers: the same place gets the same
// stone at every zoom. The lattice's values are drawn once from the dive's seeded stream (`cosmetic:dive:shore`).

import { COSMETIC_SUB_STREAM, RANDOM_STREAM, createSeededRandom, type RandomSource } from '@evolution/shared';
import { DIVE_SEED } from '../../constants/dive';
import {
  SHORE_FBM,
  SHORE_HASH,
  SHORE_LATTICE,
  SHORE_MIX,
  SHORE_UINT32_RANGE,
  SHORE_VORONOI_FAR,
} from '../../constants/dive-shore-noise';
import { smoothstep } from '../../geometry';

/** `fork(label)` for one of the shore's streams: `cosmetic:dive:shore:<name>`. */
export function shoreRandom(name: string): RandomSource {
  const label = `${RANDOM_STREAM.cosmetic}:${COSMETIC_SUB_STREAM.dive}:shore:${name}`;
  return createSeededRandom(DIVE_SEED).fork(label);
}

/** A uniform number in [0, 1) for the integer triple (`hash`): a place's own roll, the same at every zoom. */
export function coordinateHash(x: number, y: number, salt: number): number {
  let mixed =
    Math.imul(x | 0, SHORE_HASH.xMultiplier) ^
    Math.imul(y | 0, SHORE_HASH.yMultiplier) ^
    Math.imul(salt | 0, SHORE_HASH.saltMultiplier);
  mixed = Math.imul(mixed ^ (mixed >>> SHORE_HASH.firstShift), SHORE_HASH.mixMultiplier);
  mixed ^= mixed >>> SHORE_HASH.secondShift;
  return (mixed >>> 0) / SHORE_UINT32_RANGE;
}

/** The 32-bit finaliser (`mix32`): the coast refinement's child hashes come from their parent's. */
export function mixHash(value: number): number {
  let mixed = Math.imul(value ^ (value >>> SHORE_MIX.firstShift), SHORE_MIX.firstMultiplier);
  mixed = Math.imul(mixed ^ (mixed >>> SHORE_MIX.middleShift), SHORE_MIX.secondMultiplier);
  return (mixed ^ (mixed >>> SHORE_MIX.lastShift)) >>> 0;
}

function lerp(from: number, target: number, fraction: number): number {
  return from + (target - from) * fraction;
}

/** Plain value noise on the plane (`vnoise`): the world-stable choices, beaches and the zones' wandering reach. */
export function valueNoise(x: number, y: number, salt: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const easeX = smoothstep(0, 1, x - cellX);
  const easeY = smoothstep(0, 1, y - cellY);
  const top = lerp(coordinateHash(cellX, cellY, salt), coordinateHash(cellX + 1, cellY, salt), easeX);
  const bottom = lerp(coordinateHash(cellX, cellY + 1, salt), coordinateHash(cellX + 1, cellY + 1, salt), easeX);
  return lerp(top, bottom, easeY);
}

function wrapIndex(index: number, period: number): number {
  const wrapped = index % period;
  return wrapped < 0 ? wrapped + period : wrapped;
}

/** One Voronoi query's answer: the distances to the nearest and second-nearest site, in tile units. */
export interface VoronoiDistances {
  readonly nearest: number;
  readonly second: number;
}

/** Jitters a site of a wrapping Voronoi grid: `(cellX, cellY, axis)` → a number in [0, 1). */
export type SiteJitter = (cellX: number, cellY: number, axis: number) => number;

/** The periodic noise the tile bakes are drawn from: value noise on a lattice that wraps, so the tile does too. */
export class PeriodicNoise {
  private readonly lattice = new Float32Array(SHORE_LATTICE.size);

  constructor(random: RandomSource) {
    for (let index = 0; index < this.lattice.length; index += 1) this.lattice[index] = random.nextFloat();
  }

  private latticeAt(x: number, y: number, salt: number): number {
    const index =
      (Math.imul(salt, SHORE_LATTICE.saltMultiplier) +
        Math.imul(y, SHORE_LATTICE.yMultiplier) +
        Math.imul(x, SHORE_LATTICE.xMultiplier)) &
      (SHORE_LATTICE.size - 1);
    return this.lattice[index] ?? 0;
  }

  /** Value noise wrapping every `periodX × periodY` lattice cells (`pnoise`). */
  noise(x: number, y: number, period: { readonly x: number; readonly y: number }, salt: number): number {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const easeX = smoothstep(0, 1, x - cellX);
    const easeY = smoothstep(0, 1, y - cellY);
    const cellX0 = wrapIndex(cellX, period.x);
    const cellY0 = wrapIndex(cellY, period.y);
    const cellX1 = cellX0 + 1 === period.x ? 0 : cellX0 + 1;
    const cellY1 = cellY0 + 1 === period.y ? 0 : cellY0 + 1;
    const top = lerp(this.latticeAt(cellX0, cellY0, salt), this.latticeAt(cellX1, cellY0, salt), easeX);
    const bottom = lerp(this.latticeAt(cellX0, cellY1, salt), this.latticeAt(cellX1, cellY1, salt), easeX);
    return lerp(top, bottom, easeY);
  }

  /**
   * A fractal sum of `octaves` periodic noises (`pfbm`): `frequency` lattice cells across the tile on each axis, so
   * `(across, down)` in tile units [0, 1) wraps.
   */
  fbm(
    point: { readonly across: number; readonly down: number },
    frequency: { readonly x: number; readonly y: number },
    octaves: number,
    salt: number,
  ): number {
    const { across, down } = point;
    let sum = 0;
    let weight = SHORE_FBM.firstWeight;
    let totalWeight = 0;
    let scale = 1;
    for (let octave = 0; octave < octaves; octave += 1) {
      const period = { x: frequency.x * scale, y: frequency.y * scale };
      sum += weight * this.noise(across * period.x, down * period.y, period, salt + octave * SHORE_FBM.saltStep);
      totalWeight += weight;
      scale *= SHORE_FBM.lacunarity;
      weight *= SHORE_FBM.gain;
    }
    return sum / totalWeight;
  }
}

/** The square frequency most bakes use: `n` cells across on both axes. */
export function square(frequency: number): { readonly x: number; readonly y: number } {
  return { x: frequency, y: frequency };
}

/** The nearest and second-nearest site of a jittered `grid × grid` Voronoi that wraps, at `(across, down)` in [0, 1) (`vor`). */
export function wrappingVoronoi(across: number, down: number, grid: number, jitter: SiteJitter): VoronoiDistances {
  const gridX = across * grid;
  const gridY = down * grid;
  const cellX = Math.floor(gridX);
  const cellY = Math.floor(gridY);
  let nearest = SHORE_VORONOI_FAR;
  let second = SHORE_VORONOI_FAR;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const siteCellX = cellX + offsetX;
      const siteCellY = cellY + offsetY;
      const wrappedX = wrapIndex(siteCellX, grid);
      const wrappedY = wrapIndex(siteCellY, grid);
      // `cx + .5 + (jit − .5)`: the site at its cell's corner plus the jitter
      const siteX = siteCellX + jitter(wrappedX, wrappedY, 0);
      const siteY = siteCellY + jitter(wrappedX, wrappedY, 1);
      const squared = (siteX - gridX) * (siteX - gridX) + (siteY - gridY) * (siteY - gridY);
      if (squared < nearest) {
        second = nearest;
        nearest = squared;
      } else if (squared < second) second = squared;
    }
  }
  return { nearest: Math.sqrt(nearest) / grid, second: Math.sqrt(second) / grid };
}
