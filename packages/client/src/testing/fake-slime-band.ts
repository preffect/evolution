// A recording stand-in for the dive's slime band (docs/rendering/opening-dive.md §4, ticket #803): what the dive's
// layers ask of it, with no bake, mesh or shader behind it, so the session's specs run without WebGL or Canvas 2D.

import { Container } from 'pixi.js';
import type { SlimeBandHandle, SlimeBandMaker } from '../app/game/render/dive/dive-band-loader';
import type { DiveView } from '../app/game/render/dive/dive-view';

export interface FakeSlimeBand extends SlimeBandHandle {
  /** Each frame drawn. */
  readonly draws: DiveView[];
  /** Its bakes have landed; a spec clears it to hold the autoplay. */
  isReady: boolean;
  /** Where a fall waits; a spec raises it to hold one. */
  fallFloorZoom: number;
  readonly lifecycle: { isDestroyed: boolean };
}

export interface FakeSlimeMaker extends SlimeBandMaker {
  readonly bands: FakeSlimeBand[];
  /** The bakes the dive's pump runs: `isBaked` from the start unless a spec clears it. */
  readonly bakes: { isBaked: boolean; pumped: number; pumpBakes(budgetMs: number): boolean };
}

/** Slime bands that show wherever the band table has the slime active. */
export function fakeSlimeMaker(): FakeSlimeMaker {
  const bands: FakeSlimeBand[] = [];
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
      const band: FakeSlimeBand = {
        view: new Container(),
        draws: [],
        isReady: true,
        fallFloorZoom: Number.NEGATIVE_INFINITY,
        lifecycle: { isDestroyed: false },
        draw: (view) => {
          band.draws.push(view);
          return view.bands.slime.isActive;
        },
        destroy: () => {
          band.lifecycle.isDestroyed = true;
          band.view.destroy();
        },
      };
      bands.push(band);
      return { band, bakes };
    },
  };
}
