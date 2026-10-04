// The dive's upper bands as the stage gets them (docs/rendering/opening-dive.md §4): the planet's bakes, the shore band
// (`shore/`, ticket #801), the kelp band (`kelp/`, ticket #802) and the slime band (`slime/`, ticket #803), all drawn on
// the dive's own Pixi canvas, one WebGL context. The modules, the planet's bakes and the coastlines load with the dive
// — separate chunks and two JSON files — never with the game.

import type { Scheduler } from '@evolution/shared';
import type { Container } from 'pixi.js';
import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import type { DiveBaker } from './dive-bake-pump';
import type { DivePlanetKeptBakes, DivePlanetSource } from './dive-planet-band';
import type { DiveView } from './dive-view';
import type { DiveCoastRing } from './planet/dive-planet-bakes';
import type { RenderToTexture } from './planet/dive-planet-mesh';

/** A band on the dive's stage as the stage drives it; a spec gives a recording one. */
export interface DiveBandHandle {
  /** Its meshes, which go on the dive's stage. */
  readonly view: Container;
  /** Its bakes have landed. */
  readonly isReady: boolean;
  /** The zoom a fall must wait above until what lies below it is ready. */
  readonly fallFloorZoom: number;
  destroy(): void;
}

/** The shore band (`shore/dive-shore-band.ts`). */
export interface ShoreBandHandle extends DiveBandHandle {
  bakeOn(scheduler: Scheduler, nowMs: () => number, onBaked: () => void): void;
  /** Sets the quad up for this frame; answers whether it shows. */
  draw(view: DiveView, isForestShown: boolean): boolean;
}

/** What makes the shore band (`shore/shore-module.ts`'s parts); it warms its shader up through `renderToTexture`. */
export interface ShoreBandMaker {
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): ShoreBandHandle;
}

/** The kelp band (`kelp/dive-kelp-band.ts`) or the slime band (`slime/dive-slime-band.ts`). */
export interface MeshBandHandle extends DiveBandHandle {
  /** Sets its meshes up for this frame; answers whether any shows. */
  draw(view: DiveView): boolean;
}

export type KelpBandHandle = MeshBandHandle;
export type SlimeBandHandle = MeshBandHandle;

/** What makes the kelp band (`kelp/kelp-module.ts`'s parts): its bakes, which the dive's pump runs, and the band. */
export interface KelpBandMaker {
  readonly bakes: DiveBaker;
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): KelpBandHandle;
}

/** What makes the slime band (`slime/slime-module.ts`'s parts): the band and its bakes, drawn at its pixel ratio. */
export interface SlimeBandMaker {
  createBand(
    renderToTexture: RenderToTexture,
    devicePixelRatio: number,
  ): { readonly band: SlimeBandHandle; readonly bakes: DiveBaker };
}

/** Whether the planet's forest shows under the shore (`shore/shore-forest-test.ts`). */
export interface DiveForestTest {
  isShown(view: DiveView): boolean;
}

/** What the dive's lazy chunks give the session: the planet's bakes, the shore, the kelp and the slime. */
export interface DiveUpperBands {
  readonly planet: DivePlanetSource;
  readonly shore: ShoreBandMaker;
  readonly kelp: KelpBandMaker;
  readonly slime: SlimeBandMaker;
  readonly forest: DiveForestTest;
}

/** Fetches the modules, the planet's bakes and the coastlines they draw from; the bands run on the dive's clock. */
export type DiveUpperBandsLoader = (nowMs: () => number) => Promise<DiveUpperBands>;

/** `fetch` as the loader needs it: a spec passes its own. */
export type JsonFetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

async function fetchRings(fetchJson: JsonFetch, url: string): Promise<readonly DiveCoastRing[]> {
  const response = await fetchJson(url);
  if (!response.ok) throw new Error(`The dive's coastline ${url} answered ${response.status}`);
  return (await response.json()) as readonly DiveCoastRing[];
}

/**
 * The loader over `fetchJson`: the chunks and the two files in parallel. The planet's finished bakes are kept with the
 * loader, which lives for the page, so a return to the lobby does not bake them again; the kelp and the slime share
 * the shore's tiles and canvases.
 */
export function diveUpperBandsLoader(fetchJson: JsonFetch, documentReference: Document): DiveUpperBandsLoader {
  const kept: DivePlanetKeptBakes = new Map();
  return async (nowMs) => {
    const [planetModule, shoreModule, kelpModule, slimeModule, worldRings, salishRings] = await Promise.all([
      import('./planet/dive-planet-bakes'),
      import('./shore/shore-module'),
      import('./kelp/kelp-module'),
      import('./slime/slime-module'),
      fetchRings(fetchJson, DIVE_WORLD_RINGS_URL),
      fetchRings(fetchJson, DIVE_SALISH_RINGS_URL),
    ]);
    const shore = shoreModule.createShoreParts(salishRings, documentReference);
    return {
      planet: { plan: planetModule.createDivePlanetBakePlan(worldRings, salishRings), kept },
      shore,
      kelp: kelpModule.createKelpParts(shore, nowMs),
      slime: slimeModule.createSlimeParts(shore, nowMs),
      forest: shore.forest,
    };
  };
}

/** The real loader, over the page's `fetch` and document. */
export const loadDiveUpperBands: DiveUpperBandsLoader = diveUpperBandsLoader((url) => fetch(url), document);
