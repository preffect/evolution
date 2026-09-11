import { describe, expect, it } from 'vitest';
import { RENDER_BENCH_DEFAULT_TICK, RENDER_BENCH_DEFAULT_ZOOM, RENDER_BENCH_SEED } from '../constants';
import { isBenchRoute, parseBenchQuery } from './bench-session';

describe('parseBenchQuery', () => {
  it('reads the seed, tick and zoom with defaults for what is missing or malformed', () => {
    expect(parseBenchQuery('?bench=7&tick=300&zoom=1.8')).toEqual({ seed: 7, tick: 300, zoom: 1.8 });
    expect(parseBenchQuery('?bench')).toEqual({
      seed: RENDER_BENCH_SEED,
      tick: RENDER_BENCH_DEFAULT_TICK,
      zoom: RENDER_BENCH_DEFAULT_ZOOM,
    });
    expect(parseBenchQuery('?bench=abc&tick=1.9&zoom=x').seed).toBe(RENDER_BENCH_SEED);
    expect(parseBenchQuery('?bench=abc&tick=1.9&zoom=x').tick).toBe(1);
  });

  it('selects the bench route only when the bench parameter is present', () => {
    expect(isBenchRoute('?bench=42')).toBe(true);
    expect(isBenchRoute('?bench')).toBe(true);
    expect(isBenchRoute('?tick=3')).toBe(false);
    expect(isBenchRoute('')).toBe(false);
  });
});
