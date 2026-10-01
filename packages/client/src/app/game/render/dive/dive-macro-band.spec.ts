// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's two canvases under the game's,
// the shore's between them (ticket #801), and the loader that brings the mockup's and the shore's modules and the
// coastlines in with the dive. The real module draws on a 2D canvas jsdom has not got, so the loader is checked up to
// the bands it makes, and the band over a recording stand-in.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import { DiveMacroBand, upperBandsLoader, type JsonFetch } from './dive-macro-band';
import type { MockupBands, MockupFrame } from './mockup/dive-mockup-bands';

/** One closed square ring round the focus, in [longitude, latitude] degrees. */
const RING = [
  [-123.4, 48.4],
  [-123.3, 48.4],
  [-123.3, 48.5],
  [-123.4, 48.5],
  [-123.4, 48.4],
];

function recordingBands(): MockupBands & { readonly frames: MockupFrame[]; released: number } {
  const frames: MockupFrame[] = [];
  return {
    canvas: document.createElement('canvas'),
    upperCanvas: document.createElement('canvas'),
    isForestShown: true,
    isBaked: true,
    isPlanetReady: true,
    frames,
    released: 0,
    draw: (frame) => frames.push(frame),
    pumpBakes: () => true,
    release() {
      this.released += 1;
    },
  };
}

describe('upperBandsLoader', () => {
  it('fetches both coastlines and makes the mockup’s bands, with the shore’s coast and tiles, on the dive’s clock', async () => {
    const fetched: string[] = [];
    const fetchJson: JsonFetch = (url) => {
      fetched.push(url);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([RING]) });
    };
    const { mockup, shore } = await upperBandsLoader(fetchJson, document)(() => 0);
    expect(fetched.sort()).toEqual([DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL].sort());
    expect(mockup.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(mockup.upperCanvas).toBeInstanceOf(HTMLCanvasElement);
    expect(mockup.upperCanvas).not.toBe(mockup.canvas);
    expect(typeof shore.createBand).toBe('function');
    mockup.release();
  });

  it('fails the open when a coastline is missing, naming it', async () => {
    const fetchJson: JsonFetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    await expect(upperBandsLoader(fetchJson, document)(() => 0)).rejects.toThrow(DIVE_WORLD_RINGS_URL);
  });
});

describe('DiveMacroBand', () => {
  const frame = { zoom: 2 } as MockupFrame;

  it('lays the planet’s canvas first in the stage and the kelp’s next, under whatever the app appends', () => {
    const host = document.createElement('div');
    const game = document.createElement('canvas');
    host.append(game);
    const bands = recordingBands();
    new DiveMacroBand(bands, host);
    expect([...host.children]).toEqual([bands.canvas, bands.upperCanvas, game]);
  });

  it('stacks the shore’s canvas between the planet’s and the kelp’s', () => {
    const host = document.createElement('div');
    const game = document.createElement('canvas');
    const shore = document.createElement('canvas');
    host.append(game, shore);
    const bands = recordingBands();
    new DiveMacroBand(bands, host).stackShore(shore);
    expect([...host.children]).toEqual([bands.canvas, shore, bands.upperCanvas, game]);
  });

  it('draws and shows its canvas while a mockup band draws; hides it and draws nothing otherwise', () => {
    const bands = recordingBands();
    const band = new DiveMacroBand(bands, document.createElement('div'));
    band.draw(frame, true);
    expect(bands.frames).toEqual([frame]);
    expect(bands.canvas.hidden).toBe(false);
    expect(bands.upperCanvas.hidden).toBe(false);
    band.draw(frame, false);
    expect(bands.frames).toHaveLength(1);
    expect(bands.canvas.hidden).toBe(true);
    expect(bands.upperCanvas.hidden).toBe(true);
  });

  it('bakes on the scheduler as the mockup’s pump did: 8 ms slices every 10 ms from 60 ms, until every tile is made', () => {
    const scheduler = new ManualScheduler();
    const budgets: number[] = [];
    let slicesLeft = 3;
    const bands: MockupBands = {
      ...recordingBands(),
      get isBaked() {
        return slicesLeft === 0;
      },
      pumpBakes(budgetMs) {
        budgets.push(budgetMs);
        slicesLeft -= 1;
        return slicesLeft === 1;
      },
    };
    let landed = 0;
    new DiveMacroBand(bands, document.createElement('div')).bakeOn(scheduler, () => (landed += 1));
    scheduler.advanceMilliseconds(59);
    expect(budgets).toEqual([]);
    scheduler.advanceMilliseconds(1);
    expect(budgets).toEqual([8]);
    for (let step = 0; step < 5; step += 1) scheduler.advanceMilliseconds(10);
    expect(budgets).toEqual([8, 8, 8]);
    expect(landed).toBe(1);
    expect(scheduler.pendingCallCount).toBe(0);
  });

  it('stops baking when the dive closes', () => {
    const scheduler = new ManualScheduler();
    const band = new DiveMacroBand({ ...recordingBands(), isBaked: false }, document.createElement('div'));
    band.bakeOn(scheduler, () => undefined);
    band.destroy();
    expect(scheduler.pendingCallCount).toBe(0);
  });

  it('leaves the stage and gives the planet’s context back on destroy', () => {
    const host = document.createElement('div');
    const bands = recordingBands();
    new DiveMacroBand(bands, host).destroy();
    expect(host.childElementCount).toBe(0);
    expect(bands.released).toBe(1);
  });
});
