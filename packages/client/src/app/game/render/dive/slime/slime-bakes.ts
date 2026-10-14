// What the slime band bakes once a page (docs/rendering/opening-dive.md §4, ticket #803): first its scatters (the
// clouds', the diatoms', the rods' and the specks' grids, which a scrub before the rest can already draw from), then
// the bacteria's atlas, the plankton's ladders, the diatoms' atlas and the kelp's two cell tiles, a few milliseconds at
// a time on the dive's bake pump (`DiveBaker`), before the autoplay falls into the band. The sprites are drawn at the
// dive's device pixel ratio; kept for the page at that ratio, so a return to the lobby bakes nothing again.

import { queueBaker, type DiveBaker } from '../dive-bake-pump';
import type { ShoreCanvas, ShoreCanvasFactory } from '../shore/shore-canvas';
import { SteppedQueue, type PumpStep } from '../shore/shore-pump';
import {
  bakeBacteriaAtlas,
  bakeDiatomAtlas,
  bakePlanktonLadders,
  type BacteriaAtlas,
  type DiatomAtlas,
  type PlanktonLadders,
} from './slime-atlases';
import { bakeCellTiles } from './slime-cell-tiles';
import { bakeSlimeScatters, type SlimeScatters } from './slime-scatter';

/** Everything the band draws its sprites and floor from once baked. */
export interface SlimeBaked {
  readonly bacteria: BacteriaAtlas;
  readonly plankton: PlanktonLadders;
  readonly diatoms: DiatomAtlas;
  readonly cells: { readonly bright: ShoreCanvas; readonly dark: ShoreCanvas };
}

/** What the bakes are drawn with: a canvas factory, at the dive's device pixel ratio. */
export interface SlimeBakeSources {
  readonly factory: ShoreCanvasFactory;
  readonly devicePixelRatio: number;
}

/** The pictures, a step at a time: the small sprites first, the plankton, the diatoms, then the cells' tiles. */
export function* bakeSlime(sources: SlimeBakeSources): Generator<void, SlimeBaked> {
  const { factory, devicePixelRatio } = sources;
  const bacteria = yield* bakeBacteriaAtlas(factory);
  const plankton = yield* bakePlanktonLadders(factory, devicePixelRatio);
  const diatoms = yield* bakeDiatomAtlas(factory, devicePixelRatio);
  const cells = yield* bakeCellTiles(factory);
  return { bacteria, plankton, diatoms, cells };
}

/** The bakes as a queue: the scatters, then the pictures, stepped a few milliseconds at a time (`slimeBaker`). */
export class SlimeBakes extends SteppedQueue {
  private readonly scatterJob: Generator<void, SlimeScatters>;
  private readonly pictureJob: Generator<void, SlimeBaked>;
  private scatterResult: SlimeScatters | null = null;
  private pictureResult: SlimeBaked | null = null;

  /** `bake` and `scatter` are the real bakes unless a spec passes quick stand-ins. */
  constructor(
    readonly sources: SlimeBakeSources,
    bake: (sources: SlimeBakeSources) => Generator<void, SlimeBaked> = bakeSlime,
    scatter: () => Generator<void, SlimeScatters> = bakeSlimeScatters,
  ) {
    super();
    this.scatterJob = scatter();
    this.pictureJob = bake(sources);
  }

  get isBaked(): boolean {
    return this.pictureResult !== null;
  }

  /** The scatters, or `null` while they are made. */
  get scatters(): SlimeScatters | null {
    return this.scatterResult;
  }

  /** What the band draws its sprites and floor from, or `null` while they bake. */
  get baked(): SlimeBaked | null {
    return this.pictureResult;
  }

  protected step(): PumpStep {
    if (this.scatterResult === null) {
      const step = this.scatterJob.next();
      if (step.done !== true) return 'stepped';
      this.scatterResult = step.value;
      return 'finished';
    }
    if (this.pictureResult !== null) return 'idle';
    const step = this.pictureJob.next();
    if (step.done !== true) return 'stepped';
    this.pictureResult = step.value;
    return 'finished';
  }
}

/** The bakes on the dive's pump, timed on `nowMs`, the open dive's clock. */
export function slimeBaker(bakes: SlimeBakes, nowMs: () => number): DiveBaker {
  return queueBaker(bakes, nowMs);
}
