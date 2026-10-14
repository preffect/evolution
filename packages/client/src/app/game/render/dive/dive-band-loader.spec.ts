// The loader that brings the dive's upper bands in with the dive (docs/rendering/opening-dive.md §4): the planet's
// bakes, the shore, the kelp and the slime (tickets #800–#803) and the coastlines they draw from, checked up to the
// parts it makes (the bands themselves draw with WebGL and Canvas 2D, which jsdom has not got).

import { describe, expect, it } from 'vitest';
import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import { diveUpperBandsLoader, type JsonFetch } from './dive-band-loader';

/** One closed square ring round the focus, in [longitude, latitude] degrees. */
const RING = [
  [-123.4, 48.4],
  [-123.3, 48.4],
  [-123.3, 48.5],
  [-123.4, 48.5],
  [-123.4, 48.4],
];

const ringsFetch: JsonFetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([RING]) });

describe('diveUpperBandsLoader', () => {
  it('fetches both coastlines and makes the bands on the dive’s clock, the planet’s bakes, the shore, the kelp and the slime', async () => {
    const fetched: string[] = [];
    const fetchJson: JsonFetch = (url) => {
      fetched.push(url);
      return ringsFetch(url);
    };
    const { planet, shore, kelp, slime, forest } = await diveUpperBandsLoader(fetchJson, document)(() => 0);
    expect(fetched.sort()).toEqual([DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL].sort());
    expect(planet.plan.regionBox).toEqual({ west: -123.4, south: 48.4, east: -123.3, north: 48.5 });
    expect(typeof shore.createBand).toBe('function');
    expect(typeof kelp.createBand).toBe('function');
    expect(kelp.bakes.isBaked).toBe(false);
    expect(typeof slime.createBand).toBe('function');
    expect(typeof forest.isShown).toBe('function');
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
