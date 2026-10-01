// A recording stand-in for the dive's shore band (docs/rendering/opening-dive.md §4, ticket #801): what the dive's
// stage asks of it, with no Pixi app, tile or level behind it, so the session's specs run without Canvas 2D.

import type { PixiAppHandle } from '../app/game/render/pixi-app';
import type { ShoreBandHandle, ShoreBandMaker } from '../app/game/render/dive/dive-macro-band';
import type { DiveView } from '../app/game/render/dive/dive-view';

export interface FakeShoreBand extends ShoreBandHandle {
  /** Each frame drawn: the view and whether the planet's forest showed. */
  readonly draws: { readonly view: DiveView; readonly isForestShown: boolean }[];
  readonly sizes: { readonly width: number; readonly height: number }[];
  /** Its tiles and top level have baked; a spec clears it to hold the autoplay. */
  isReady: boolean;
  readonly bakes: { started: number };
  readonly lifecycle: { isDestroyed: boolean };
  /** The app it was made on: destroyed with it. */
  readonly pixi: PixiAppHandle;
}

export interface FakeShoreMaker extends ShoreBandMaker {
  readonly bands: FakeShoreBand[];
}

export function fakeShoreMaker(): FakeShoreMaker {
  const bands: FakeShoreBand[] = [];
  return {
    bands,
    createBand: (pixi) => {
      const band: FakeShoreBand = {
        canvas: pixi.canvas,
        draws: [],
        sizes: [],
        isReady: true,
        bakes: { started: 0 },
        lifecycle: { isDestroyed: false },
        pixi,
        bakeOn: () => {
          band.bakes.started += 1;
        },
        draw: (view, isForestShown) => band.draws.push({ view, isForestShown }),
        resize: (sizePx) => band.sizes.push(sizePx),
        destroy: () => {
          band.lifecycle.isDestroyed = true;
          pixi.destroy();
        },
      };
      bands.push(band);
      return band;
    },
  };
}
