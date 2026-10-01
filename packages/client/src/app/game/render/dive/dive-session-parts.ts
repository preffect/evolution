// What a dive opens with (docs/rendering/opening-dive.md §1): the game's Pixi app and the upper bands in parallel,
// then the shore's own Pixi app (ticket #801), made after the game's so the game's is always the first the page made.
// When any part fails, or the dive closed meanwhile, every part that did arrive is given back at once.

import type { PixiAppHandle } from '../pixi-app';
import type { DiveUpperBands } from './dive-macro-band';

export interface DiveSessionParts {
  readonly pixi: PixiAppHandle;
  readonly bands: DiveUpperBands;
  readonly shorePixi: PixiAppHandle;
}

export interface DivePartOpeners {
  readonly createApp: () => Promise<PixiAppHandle>;
  readonly loadBands: () => Promise<DiveUpperBands>;
  /** The dive closed while its parts were on their way. */
  readonly isClosed: () => boolean;
}

const FULFILLED = 'fulfilled';

function valueOf<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === FULFILLED ? result.value : null;
}

function giveBack(parts: {
  readonly pixi: PixiAppHandle | null;
  readonly bands: DiveUpperBands | null;
  readonly shorePixi: PixiAppHandle | null;
}): null {
  parts.pixi?.destroy();
  parts.shorePixi?.destroy();
  parts.bands?.mockup.release();
  return null;
}

/** Every part, or `null` with the ones that arrived given back. */
export async function openDiveParts(openers: DivePartOpeners): Promise<DiveSessionParts | null> {
  const [pixiResult, bandsResult] = await Promise.allSettled([openers.createApp(), openers.loadBands()]);
  const pixi = valueOf(pixiResult);
  const bands = valueOf(bandsResult);
  if (pixi === null || bands === null || openers.isClosed()) return giveBack({ pixi, bands, shorePixi: null });
  const shorePixi = await openers.createApp().catch(() => null);
  if (shorePixi === null || openers.isClosed()) return giveBack({ pixi, bands, shorePixi });
  return { pixi, bands, shorePixi };
}
