// The shore's tile set (docs/rendering/opening-dive.md §4, ticket #801): every code-drawn tile, baked once a page in
// the order the dive needs them, a few milliseconds at a time (the mockup's `pump`); a tile asked for before its turn
// jumps the queue and is drawn as nothing meanwhile. Each finished tile keeps its mean colour, which stands in for it
// once it shrinks below a few pixels. The kelp band (ticket #802) draws its rock with these tiles.

import { SHORE_TILE_AVERAGE_STRIDE } from '../../constants/dive-shore';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, RGBA_CHANNELS } from '../../colour';
import { rasterise, type ShoreCanvas, type ShoreCanvasFactory } from './shore-canvas';
import { PeriodicNoise, shoreRandom } from './shore-noise';
import { SteppedQueue, type PumpStep } from './shore-pump';
import { bakeBarnaclesFar, bakeLowZoneFar, bakeMusselsFar, bakeRockweedFar } from './shore-tiles-far';
import { bakeKelpBed, bakeKelpBedFar, bakeSeabed } from './shore-tiles-floor';
import { bakeGrain, bakeLichen, bakeRock, type TileBake, type TileBakeKit } from './shore-tiles-rock';
import { bakeRockweed } from './shore-tiles-rockweed';
import { bakeCaustic, bakeFoam, bakeGlints, bakeRipples, bakeSand, bakeSwell } from './shore-tiles-water';
import { bakeBarnacles, bakeLowZone, bakeMussels } from './shore-tiles-zones';

/** Every tile, in the order the dive needs them (the mockup's `BAKE_ORDER`, under its names). */
export const SHORE_TILE_BAKES = {
  rock: bakeRock,
  grain: bakeGrain,
  lichenBlack: bakeLichen,
  kelpbedFar: bakeKelpBedFar,
  swell: bakeSwell,
  barnacleFar: bakeBarnaclesFar,
  musselFar: bakeMusselsFar,
  rockweedFar: bakeRockweedFar,
  lowzoneFar: bakeLowZoneFar,
  seabed: bakeSeabed,
  caustic: bakeCaustic,
  foam: bakeFoam,
  kelpbed: bakeKelpBed,
  ripple: bakeRipples,
  glint: bakeGlints,
  sand: bakeSand,
  barnacle: bakeBarnacles,
  mussel: bakeMussels,
  lowzone: bakeLowZone,
  rockweed: bakeRockweed,
} as const satisfies Record<string, TileBake>;

export type ShoreTileName = keyof typeof SHORE_TILE_BAKES;
export const SHORE_TILE_NAMES = Object.keys(SHORE_TILE_BAKES) as ShoreTileName[];

/** A finished tile: its canvas and its mean colour, premultiplied by its coverage, 0–1 channels. */
export interface ShoreTile {
  readonly canvas: ShoreCanvas;
  readonly sizePx: number;
  /** `rgba(…)` of the mean colour at the tile's mean coverage (`avg`). */
  readonly averageColour: string;
  readonly averageRgba: readonly [number, number, number, number];
}

/** The mean colour of a tile, weighted by alpha, over every `SHORE_TILE_AVERAGE_STRIDE`-th pixel (`finishTex`). */
export function averageOf(canvas: ShoreCanvas): ShoreTile['averageRgba'] {
  const data = canvas.context.getImageData(0, 0, canvas.width, canvas.height).data;
  const sums = [0, 0, 0];
  let weight = 0;
  let samples = 0;
  for (let offset = 0; offset < data.length; offset += RGBA_CHANNELS * SHORE_TILE_AVERAGE_STRIDE) {
    const alpha = data[offset + ALPHA] ?? 0;
    sums[RED] = (sums[RED] ?? 0) + (data[offset + RED] ?? 0) * alpha;
    sums[GREEN] = (sums[GREEN] ?? 0) + (data[offset + GREEN] ?? 0) * alpha;
    sums[BLUE] = (sums[BLUE] ?? 0) + (data[offset + BLUE] ?? 0) * alpha;
    weight += alpha;
    samples += 1;
  }
  if (weight === 0) return [0, 0, 0, 0];
  const channel = (index: number): number => (sums[index] ?? 0) / weight / CHANNEL_MAX;
  return [channel(RED), channel(GREEN), channel(BLUE), weight / samples / CHANNEL_MAX];
}

function cssOf(rgba: ShoreTile['averageRgba']): string {
  const [red, green, blue, alpha] = rgba;
  const byte = (value: number): number => Math.round(value * CHANNEL_MAX);
  return `rgba(${byte(red)},${byte(green)},${byte(blue)},${alpha})`;
}

interface TileJob {
  readonly name: ShoreTileName;
  readonly bake: Generator<void, ShoreCanvas>;
}

/** A tile another thread baked, on its way: its picture and its mean colour (`ShoreTile.averageRgba`). */
export interface ShoreTileBitmap {
  readonly name: ShoreTileName;
  readonly bitmap: ImageBitmap;
  readonly averageRgba: ShoreTile['averageRgba'];
}

/** Where a drawing gets its tiles: the baked one, or `null` while it bakes. */
export interface ShoreTileSource {
  get(name: ShoreTileName): ShoreTile | null;
  readonly isBaked: boolean;
}

export class ShoreTiles extends SteppedQueue implements ShoreTileSource {
  private readonly tiles = new Map<ShoreTileName, ShoreTile>();
  private readonly wanted: ShoreTileName[] = [];
  private job: TileJob | null = null;
  private readonly kit: TileBakeKit;

  /** `bakes` is every tile's bake, the real ones unless a spec passes quick stand-ins. */
  constructor(
    factory: ShoreCanvasFactory,
    private readonly bakes: Readonly<Record<ShoreTileName, TileBake>> = SHORE_TILE_BAKES,
  ) {
    super();
    this.kit = { factory, noise: new PeriodicNoise(shoreRandom('lattice')) };
  }

  /** The finished tile, or `null` while it bakes: it then jumps the queue. */
  get(name: ShoreTileName): ShoreTile | null {
    const tile = this.tiles.get(name);
    if (tile !== undefined) return tile;
    if (!this.wanted.includes(name)) this.wanted.push(name);
    return null;
  }

  /** Whether the tile has baked, without asking for it. */
  has(name: ShoreTileName): boolean {
    return this.tiles.has(name);
  }

  get isBaked(): boolean {
    return this.tiles.size === SHORE_TILE_NAMES.length;
  }

  private nextName(): ShoreTileName | undefined {
    return [...this.wanted, ...SHORE_TILE_NAMES].find((name) => !this.tiles.has(name));
  }

  protected step(): PumpStep {
    if (this.job === null) {
      const name = this.nextName();
      if (name === undefined) return 'idle';
      this.job = { name, bake: this.bakes[name](this.kit) };
    }
    const step = this.job.bake.next();
    if (step.done !== true) return 'stepped';
    this.finish(this.job.name, step.value);
    this.job = null;
    return 'finished';
  }

  /** Bakes every tile still missing at once: a spec's, or a reader who asks for a tile with no frames to wait. */
  bakeAll(): void {
    while (!this.isBaked) this.pump(Number.POSITIVE_INFINITY, () => 0);
  }

  private finish(name: ShoreTileName, canvas: ShoreCanvas): void {
    this.adopt(name, canvas, averageOf(canvas));
  }

  /**
   * A tile another thread baked (the worker's on the page, the page's in a new worker): copied into a canvas of this
   * set's factory, its bitmap closed, and adopted with its mean colour.
   */
  adoptBitmap(tile: ShoreTileBitmap): void {
    const canvas = this.kit.factory.create(tile.bitmap.width, tile.bitmap.height);
    canvas.context.drawImage(tile.bitmap, 0, 0, canvas.width, canvas.height);
    tile.bitmap.close();
    rasterise(canvas);
    this.adopt(tile.name, canvas, tile.averageRgba);
  }

  /** A tile baked elsewhere (the worker's, or the page's posted to a new worker), with its mean colour. */
  adopt(name: ShoreTileName, canvas: ShoreCanvas, averageRgba: ShoreTile['averageRgba']): void {
    this.tiles.set(name, { canvas, sizePx: canvas.width, averageColour: cssOf(averageRgba), averageRgba });
    const index = this.wanted.indexOf(name);
    if (index >= 0) this.wanted.splice(index, 1);
  }
}
