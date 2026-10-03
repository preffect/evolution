// The dive's two halves opening together (docs/rendering/opening-dive.md §1): its Pixi app, which clears to
// transparent, and the upper bands from the lazy chunk; then the shore band's own Pixi app (ticket #801), made after
// the game's so the game's is always the first the page made. When any fails (no WebGL, a missing coastline, the
// chunk) or the dive closed meanwhile, whatever did arrive is given back at once, so nothing outlives a dive that
// never opened.

import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import type { DiveUpperBands, DiveUpperBandsLoader } from './dive-macro-band';

export interface DiveHalvesSource {
  readonly host: HTMLElement;
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly loadUpperBands: DiveUpperBandsLoader;
}

export interface DiveHalves {
  readonly pixi: PixiAppHandle;
  readonly bands: DiveUpperBands;
  /** The shore band's app, transparent, under the mockup's canvas. */
  readonly shorePixi: PixiAppHandle;
}

export interface DiveOpening {
  /** The dive's clock in milliseconds, which the bands bake on. */
  readonly nowMs: () => number;
  /** The dive closed while its halves loaded. */
  readonly isCancelled: () => boolean;
}

const FULFILLED = 'fulfilled';

function giveBack(pixi: PixiAppHandle | null, bands: DiveUpperBands | null): null {
  pixi?.destroy();
  bands?.mockup.release();
  return null;
}

/** Every part, or `null` (never a throw) with whatever arrived given back. */
export async function openDiveHalves(
  source: DiveHalvesSource,
  devicePixelRatio: number,
  opening: DiveOpening,
): Promise<DiveHalves | null> {
  const createApp = (): Promise<PixiAppHandle> =>
    source.createPixiApp({
      host: source.host,
      devicePixelRatio,
      shouldPreserveDrawingBuffer: false,
      isTransparent: true,
    });
  const [pixiResult, bandsResult] = await Promise.allSettled([createApp(), source.loadUpperBands(opening.nowMs)]);
  const pixi = pixiResult.status === FULFILLED ? pixiResult.value : null;
  const bands = bandsResult.status === FULFILLED ? bandsResult.value : null;
  if (opening.isCancelled() || pixi === null || bands === null) return giveBack(pixi, bands);
  const shorePixi = await createApp().catch(() => null);
  if (opening.isCancelled() || shorePixi === null) {
    shorePixi?.destroy();
    return giveBack(pixi, bands);
  }
  return { pixi, bands, shorePixi };
}
