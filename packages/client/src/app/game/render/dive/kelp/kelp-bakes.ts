// What the kelp band bakes once a page (docs/rendering/opening-dive.md §4, ticket #802): the blade's grain tile, the
// focal rock's outline and the coast round it as signed distances, and the spray beads' places, a few milliseconds at
// a time on the dive's bake pump (`DiveBaker`), before the autoplay falls into the band. Kept for the page, as the
// shore's tiles are, so a return to the lobby bakes nothing again.

import { KELP_BLADE_COVER, KELP_FOCAL_ROCK, KELP_ROCK_DISTANCE, KELP_SEA_DISTANCE } from '../../constants/dive-kelp';
import { SHORE_COAST_REFINE } from '../../constants/dive-shore-coast';
import { SHORE_FOCAL_ROCK } from '../../constants/dive-shore-objects';
import { queueBaker, type DiveBaker } from '../dive-bake-pump';
import { boulderPlace } from '../shore/shore-boulder';
import type { ShoreCanvas, ShoreCanvasFactory } from '../shore/shore-canvas';
import { ShoreCoast } from '../shore/shore-coast';
import type { LandRings } from '../shore/shore-coast-rings';
import { PeriodicNoise, shoreRandom } from '../shore/shore-noise';
import { POINT_STRIDE } from '../shore/shore-points';
import { SteppedQueue, type PumpStep } from '../shore/shore-pump';
import type { BlobPlace } from '../shore/shore-shapes';
import { bakeBladeTile } from './kelp-blade-tile';
import { placeBeads, type KelpBead } from './kelp-beads';
import {
  bakeOutlineDistance,
  boxRound,
  rockOutline,
  signedArea,
  windingAt,
  type KelpBox,
  type KelpDistanceBake,
} from './kelp-outline';
import { kelpBlades, type Ribbon } from './kelp-ribbons';

/** Everything the band draws from once baked. */
export interface KelpBaked {
  readonly bladeTile: ShoreCanvas;
  readonly rock: KelpDistanceBake;
  readonly sea: KelpDistanceBake;
  /** Where the blades lie (+ inside one): the rock under them is drawn plain. */
  readonly bladeCover: KelpDistanceBake;
  /**
   * Whether the rock adds to the land where it lies on it: the mockup clipped the stipe's dry run to the coast's
   * rings and the rock's outline by the nonzero rule, so where their windings cancel the stipe is left under the rock.
   */
  readonly isRockOnLandKept: boolean;
  readonly beads: readonly KelpBead[];
}

/** What the bakes are drawn from: the shore's land rings and a canvas factory. */
export interface KelpBakeSources {
  readonly land: LandRings;
  readonly factory: ShoreCanvasFactory;
}

/** The focal rock's place: the shore's boulder at `SHORE_FOCAL_ROCK`, greenstone, low on the shore. */
export function focalRockPlace(): BlobPlace {
  return boulderPlace({
    x: SHORE_FOCAL_ROCK.x,
    y: SHORE_FOCAL_ROCK.y,
    radius: SHORE_FOCAL_ROCK.radiusM,
    seed: KELP_FOCAL_ROCK.seed,
    heightM: KELP_FOCAL_ROCK.heightM,
  });
}

/**
 * Whether the nonzero rule keeps the rock where it lies on the land (`clip('nonzero')` of the coast's rings and the
 * rock's outline): their windings add unless they turn opposite ways. With no land under the rock, it is kept.
 */
export function isRockKeptOnLand(landWinding: number, rockSignedArea: number): boolean {
  return landWinding === 0 || Math.sign(landWinding) === Math.sign(rockSignedArea);
}

/** A ribbon's outline as a closed polygon: down its left margin, back up its right (`ribbonPath`). */
export function bladeOutline(ribbon: Ribbon): number[] {
  const left = ribbon.samples.flatMap((sample) => [
    sample.x - sample.tangentY * sample.leftM,
    sample.y + sample.tangentX * sample.leftM,
  ]);
  const right = [...ribbon.samples]
    .reverse()
    .flatMap((sample) => [sample.x + sample.tangentY * sample.rightM, sample.y - sample.tangentX * sample.rightM]);
  return [...left, ...right];
}

/** The box round flat point lists, `marginM` more every way. */
function boxOf(polygons: readonly (readonly number[])[], marginM: number): KelpBox {
  const xValues = polygons.flatMap((points) => points.filter((_value, index) => index % POINT_STRIDE === 0));
  const yValues = polygons.flatMap((points) => points.filter((_value, index) => index % POINT_STRIDE === 1));
  return [
    Math.min(...xValues) - marginM,
    Math.min(...yValues) - marginM,
    Math.max(...xValues) + marginM,
    Math.max(...yValues) + marginM,
  ];
}

/** The coast built over the sea box, a segment every few texels (its window: the box's widest half each way). */
function coastOver(land: LandRings, box: KelpBox, segmentM: number): ShoreCoast {
  const coast = new ShoreCoast(land);
  coast.build({
    halfWidthM: Math.max(Math.abs(box[0]), Math.abs(box[2])),
    halfHeightM: Math.max(Math.abs(box[1]), Math.abs(box[3])),
    pixelsPerMetre: SHORE_COAST_REFINE.detailPx / segmentM,
  });
  return coast;
}

/** Everything, a step at a time: the blade's tile, the rock's outline, the coast round it, the beads. */
export function* bakeKelp(sources: KelpBakeSources): Generator<void, KelpBaked> {
  const bladeTile = yield* bakeBladeTile({
    factory: sources.factory,
    noise: new PeriodicNoise(shoreRandom('lattice')),
  });
  const place = focalRockPlace();
  const outline = rockOutline(place, KELP_ROCK_DISTANCE.samplesPerCurve);
  const rockBox = boxRound(place, KELP_ROCK_DISTANCE.reachRadii);
  const rock = yield* bakeOutlineDistance([outline], rockBox, KELP_ROCK_DISTANCE.metresPerTexel);
  const seaBox = KELP_SEA_DISTANCE.box;
  const coast = coastOver(sources.land, seaBox, KELP_SEA_DISTANCE.metresPerTexel * KELP_SEA_DISTANCE.refineTexels);
  yield;
  const rings = coast.rings.map((ring) => ring.points);
  const sea = yield* bakeOutlineDistance(rings, seaBox, KELP_SEA_DISTANCE.metresPerTexel);
  const blades = kelpBlades().map(bladeOutline);
  const bladeCover = yield* bakeOutlineDistance(
    blades,
    boxOf(blades, KELP_BLADE_COVER.marginM),
    KELP_BLADE_COVER.metresPerTexel,
  );
  const beads = yield* placeBeads(kelpBlades()[0]?.samples ?? []);
  return {
    bladeTile,
    rock,
    sea,
    bladeCover,
    isRockOnLandKept: isRockKeptOnLand(windingAt(rings, place.x, place.y), signedArea(outline)),
    beads,
  };
}

/** The bakes as a queue: one generator, stepped a few milliseconds at a time (`kelpBaker` puts it on the pump). */
export class KelpBakes extends SteppedQueue {
  private readonly job: Generator<void, KelpBaked>;
  private result: KelpBaked | null = null;

  /** `bake` is the real bake unless a spec passes a quick stand-in. */
  constructor(sources: KelpBakeSources, bake: (sources: KelpBakeSources) => Generator<void, KelpBaked> = bakeKelp) {
    super();
    this.job = bake(sources);
  }

  get isBaked(): boolean {
    return this.result !== null;
  }

  /** What the band draws from, or `null` while it bakes. */
  get baked(): KelpBaked | null {
    return this.result;
  }

  protected step(): PumpStep {
    if (this.result !== null) return 'idle';
    const step = this.job.next();
    if (step.done !== true) return 'stepped';
    this.result = step.value;
    return 'finished';
  }
}

/** The bakes on the dive's pump, timed on `nowMs`, the open dive's clock. */
export function kelpBaker(bakes: KelpBakes, nowMs: () => number): DiveBaker {
  return queueBaker(bakes, nowMs);
}
