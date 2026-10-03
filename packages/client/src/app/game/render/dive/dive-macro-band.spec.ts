// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's canvas beside the game's, and
// the loader that brings the modules (the shore's too, ticket #801), the planet's bakes and the coastlines in with the
// dive. The real module draws on
// a 2D canvas jsdom has not got, so the loader is checked up to the bands it makes, and the band over a recording
// stand-in.

import { describe, expect, it } from 'vitest';
import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import { diveBandStates } from './dive-bands';
import { diveCameraAt } from './dive-camera';
import { DiveMacroBand, diveUpperBandsLoader, type JsonFetch } from './dive-macro-band';
import type { MockupBands, MockupFrame } from './mockup/dive-mockup-bands';

/** One closed square ring round the focus, in [longitude, latitude] degrees. */
const RING = [
  [-123.4, 48.4],
  [-123.3, 48.4],
  [-123.3, 48.5],
  [-123.4, 48.5],
  [-123.4, 48.4],
];

function recordingBands(isPlanetUnder = true): MockupBands & { readonly frames: MockupFrame[]; released: number } {
  const frames: MockupFrame[] = [];
  return {
    canvas: document.createElement('canvas'),
    isBaked: true,
    frames,
    released: 0,
    draw: (frame) => {
      frames.push(frame);
      return isPlanetUnder;
    },
    pumpBakes: () => true,
    release() {
      this.released += 1;
    },
  };
}

const ringsFetch: JsonFetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([RING]) });

describe('diveUpperBandsLoader', () => {
  it('fetches both coastlines and makes the bands on the dive’s clock, the planet’s bakes and the shore over them', async () => {
    const fetched: string[] = [];
    const fetchJson: JsonFetch = (url) => {
      fetched.push(url);
      return ringsFetch(url);
    };
    const { mockup, planet, shore } = await diveUpperBandsLoader(fetchJson, document)(() => 0);
    expect(fetched.sort()).toEqual([DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL].sort());
    expect(mockup.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(planet.plan.regionBox).toEqual({ west: -123.4, south: 48.4, east: -123.3, north: 48.5 });
    expect(typeof shore.createBand).toBe('function');
    mockup.release();
  });

  it('keeps the planet’s finished bakes for the page: every open of one loader shares them', async () => {
    const load = diveUpperBandsLoader(ringsFetch, document);
    const first = await load(() => 0);
    const second = await load(() => 0);
    expect(second.planet.kept).toBe(first.planet.kept);
    expect((await diveUpperBandsLoader(ringsFetch, document)(() => 0)).planet.kept).not.toBe(first.planet.kept);
  });

  it('fails the open when a coastline is missing, naming it', async () => {
    const fetchJson: JsonFetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    await expect(diveUpperBandsLoader(fetchJson, document)(() => 0)).rejects.toThrow(DIVE_WORLD_RINGS_URL);
  });
});

describe('DiveMacroBand', () => {
  const frameAt = (zoom: number): MockupFrame =>
    ({ zoom, bands: diveBandStates(diveCameraAt(zoom, { width: 800, height: 450 })) }) as MockupFrame;

  it('lays its canvas first in the stage, under whatever the app appends', () => {
    const host = document.createElement('div');
    host.append(document.createElement('canvas'));
    const bands = recordingBands();
    new DiveMacroBand(bands, host);
    expect(host.firstElementChild).toBe(bands.canvas);
  });

  it('draws and shows its canvas while a mockup band draws; hides it and draws nothing otherwise', () => {
    const bands = recordingBands();
    const band = new DiveMacroBand(bands, document.createElement('div'));
    const frame = frameAt(2);
    band.draw(frame, true);
    expect(bands.frames).toEqual([frame]);
    expect(bands.canvas.hidden).toBe(false);
    band.draw(frame, false);
    expect(bands.frames).toHaveLength(1);
    expect(bands.canvas.hidden).toBe(true);
  });

  it('says whether the planet shows under it: the mockup’s answer while it draws, the band table’s otherwise', () => {
    const band = new DiveMacroBand(recordingBands(false), document.createElement('div'));
    expect(band.draw(frameAt(2), true)).toBe(false);
    expect(band.draw(frameAt(7), false)).toBe(true);
    expect(band.draw(frameAt(-4.5), false)).toBe(false);
  });

  it('lies over the game’s canvas while the planet shows under it, and under it again after', () => {
    const host = document.createElement('div');
    const bands = recordingBands();
    const band = new DiveMacroBand(bands, host);
    const gameCanvas = document.createElement('canvas');
    host.append(gameCanvas);
    band.stackOverGame(true);
    expect(host.firstElementChild).toBe(gameCanvas);
    expect(host.lastElementChild).toBe(bands.canvas);
    band.stackOverGame(false);
    expect(host.firstElementChild).toBe(bands.canvas);
    expect(host.lastElementChild).toBe(gameCanvas);
  });

  it('bakes the mockup’s tiles through the mockup', () => {
    const band = new DiveMacroBand({ ...recordingBands(), isBaked: false }, document.createElement('div'));
    expect(band.pumpBakes(8)).toBe(true);
    expect(band.isBaked).toBe(false);
  });

  it('leaves the stage and releases the mockup’s canvases on destroy', () => {
    const host = document.createElement('div');
    const bands = recordingBands();
    new DiveMacroBand(bands, host).destroy();
    expect(host.childElementCount).toBe(0);
    expect(bands.released).toBe(1);
  });
});
