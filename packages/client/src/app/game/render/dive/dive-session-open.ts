// The dive's two halves opening together (docs/rendering/opening-dive.md §1): its Pixi app, which clears to
// transparent, and the upper bands from the lazy chunk. When either fails (no WebGL, a missing coastline, the chunk)
// or the dive closed meanwhile, the app is given back at once if it arrived, so nothing outlives a dive that never
// opened (the bands hold nothing yet but the bakes they keep for the page).

import type { Clock, Scheduler } from '@evolution/shared';
import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import type { DiveUpperBands, DiveUpperBandsLoader } from './dive-band-loader';
import type { DiveFrameTimes } from './dive-frame-times';
import { DiveUpperLayers } from './dive-upper-layers';

export interface DiveHalvesSource {
  readonly host: HTMLElement;
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly loadUpperBands: DiveUpperBandsLoader;
}

export interface DiveHalves {
  readonly pixi: PixiAppHandle;
  readonly bands: DiveUpperBands;
}

export interface DiveOpening {
  /** The dive's clock in milliseconds, which the bands bake on. */
  readonly nowMs: () => number;
  /** The dive closed while its halves loaded. */
  readonly isCancelled: () => boolean;
}

const FULFILLED = 'fulfilled';

/** Both halves, or `null` (never a throw) with whatever arrived given back. */
export async function openDiveHalves(
  source: DiveHalvesSource,
  devicePixelRatio: number,
  opening: DiveOpening,
): Promise<DiveHalves | null> {
  const [pixiResult, bandsResult] = await Promise.allSettled([
    source.createPixiApp({
      host: source.host,
      devicePixelRatio,
      shouldPreserveDrawingBuffer: false,
      isTransparent: true,
    }),
    source.loadUpperBands(opening.nowMs),
  ]);
  const pixi = pixiResult.status === FULFILLED ? pixiResult.value : null;
  const bands = bandsResult.status === FULFILLED ? bandsResult.value : null;
  if (opening.isCancelled() || pixi === null || bands === null) {
    pixi?.destroy();
    return null;
  }
  return { pixi, bands };
}

/** What the upper layers are built with beside the opened halves. */
export interface DiveUpperLayersOpening {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly frameTimes: DiveFrameTimes;
  readonly devicePixelRatio: number;
  /** A bake landed: a still dive draws once more. */
  readonly onBaked: () => void;
}

/** The upper bands on the opened app's stage, their bakes started on the scheduler. */
export function openDiveUpperLayers({ pixi, bands }: DiveHalves, opening: DiveUpperLayersOpening): DiveUpperLayers {
  const upper = new DiveUpperLayers({
    bands,
    stage: pixi.app.stage,
    clock: opening.clock,
    frameTimes: opening.frameTimes,
    renderToTexture: (container, target) => pixi.renderToTexture(container, target),
    devicePixelRatio: opening.devicePixelRatio,
  });
  upper.bakeOn(opening.scheduler, opening.onBaked);
  return upper;
}
