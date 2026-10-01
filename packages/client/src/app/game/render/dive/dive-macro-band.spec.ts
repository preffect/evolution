// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's canvas under the game's, and
// the loader that brings the module and its coastlines in with the dive. The real module draws on a 2D canvas jsdom
// has not got, so the loader is checked up to the bands it makes, and the band over a recording stand-in.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import { DiveMacroBand, mockupBandsLoader, type JsonFetch } from './dive-macro-band';
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

describe('mockupBandsLoader', () => {
  it('fetches both coastlines and makes the bands on the dive’s clock', async () => {
    const fetched: string[] = [];
    const fetchJson: JsonFetch = (url) => {
      fetched.push(url);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([RING]) });
    };
    const bands = await mockupBandsLoader(fetchJson)(() => 0);
    expect(fetched.sort()).toEqual([DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL].sort());
    expect(bands.canvas).toBeInstanceOf(HTMLCanvasElement);
    bands.release();
  });

  it('fails the open when a coastline is missing, naming it', async () => {
    const fetchJson: JsonFetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    await expect(mockupBandsLoader(fetchJson)(() => 0)).rejects.toThrow(DIVE_WORLD_RINGS_URL);
  });
});

describe('DiveMacroBand', () => {
  const frame = { zoom: 2 } as MockupFrame;

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
    band.draw(frame, true);
    expect(bands.frames).toEqual([frame]);
    expect(bands.canvas.hidden).toBe(false);
    band.draw(frame, false);
    expect(bands.frames).toHaveLength(1);
    expect(bands.canvas.hidden).toBe(true);
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
