// A recording stand-in for the dive's kelp band and the planet's forest test (docs/rendering/opening-dive.md §4,
// ticket #802): what the dive's layers ask of them, with no bake, mesh or shader behind them, so the session's specs
// run without WebGL or Canvas 2D.

import { Container } from 'pixi.js';
import type { DiveForestTest, KelpBandHandle, KelpBandMaker } from '../app/game/render/dive/dive-band-loader';
import type { DiveView } from '../app/game/render/dive/dive-view';

export interface FakeKelpBand extends KelpBandHandle {
  /** Each frame drawn. */
  readonly draws: DiveView[];
  /** Its bakes have landed; a spec clears it to hold the autoplay. */
  isReady: boolean;
  /** Where a fall waits; a spec raises it to hold one. */
  fallFloorZoom: number;
  readonly lifecycle: { isDestroyed: boolean };
}

export interface FakeKelpMaker extends KelpBandMaker {
  readonly bands: FakeKelpBand[];
  /** The bakes the dive's pump runs: `isBaked` from the start unless a spec clears it. */
  readonly bakes: { isBaked: boolean; pumped: number; pumpBakes(budgetMs: number): boolean };
}

/** Kelp bands that show wherever the band table has the kelp or the drop active. */
export function fakeKelpMaker(): FakeKelpMaker {
  const bands: FakeKelpBand[] = [];
  const bakes = {
    isBaked: true,
    pumped: 0,
    pumpBakes: (): boolean => {
      bakes.pumped += 1;
      return false;
    },
  };
  return {
    bands,
    bakes,
    createBand: () => {
      const band: FakeKelpBand = {
        view: new Container(),
        draws: [],
        isReady: true,
        fallFloorZoom: Number.NEGATIVE_INFINITY,
        lifecycle: { isDestroyed: false },
        draw: (view) => {
          band.draws.push(view);
          return view.bands.kelp.isActive || view.bands.drop.isActive;
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

/** A forest test that answers as the band table does: the planet shows wherever its band is active. */
export function fakeForestTest(): DiveForestTest & { readonly views: DiveView[] } {
  const views: DiveView[] = [];
  return {
    views,
    isShown: (view) => {
      views.push(view);
      return view.bands.planet.isActive;
    },
  };
}
