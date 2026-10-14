// A recording stand-in for the dive's shore band (docs/rendering/opening-dive.md §4, ticket #801): what the dive's
// layers ask of it, with no tile, level or shader behind it, so the session's specs run without Canvas 2D.

import type { Scheduler } from '@evolution/shared';
import { Container } from 'pixi.js';
import type { ShoreBandHandle, ShoreBandMaker } from '../app/game/render/dive/dive-band-loader';
import type { DiveView } from '../app/game/render/dive/dive-view';

export interface FakeShoreBand extends ShoreBandHandle {
  /** Each frame drawn: the view and whether the planet's forest showed. */
  readonly draws: { readonly view: DiveView; readonly isForestShown: boolean }[];
  /** Its tiles and top level have baked; a spec clears it to hold the autoplay. */
  isReady: boolean;
  /** Where a fall waits; a spec raises it to hold one. */
  fallFloorZoom: number;
  /** How often its bakes were started, and the scheduler they were handed (the session's timed one). */
  readonly bakes: { started: number; scheduler: Scheduler | null };
  readonly lifecycle: { isDestroyed: boolean };
}

export interface FakeShoreMaker extends ShoreBandMaker {
  readonly bands: FakeShoreBand[];
}

/** Shore bands that show wherever the band table has the shore active. */
export function fakeShoreMaker(): FakeShoreMaker {
  const bands: FakeShoreBand[] = [];
  return {
    bands,
    createBand: () => {
      const band: FakeShoreBand = {
        view: new Container(),
        draws: [],
        isReady: true,
        fallFloorZoom: Number.NEGATIVE_INFINITY,
        bakes: { started: 0, scheduler: null },
        lifecycle: { isDestroyed: false },
        bakeOn: (scheduler) => {
          band.bakes.started += 1;
          band.bakes.scheduler = scheduler;
        },
        draw: (view, isForestShown) => {
          band.draws.push({ view, isForestShown });
          return view.bands.shore.isActive;
        },
        destroy: () => {
          band.lifecycle.isDestroyed = true;
          band.view.destroy();
        },
      };
      bands.push(band);
      return band;
    },
  };
}
