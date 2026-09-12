import { describe, expect, it } from 'vitest';
import { RENDER_BENCH_SEED } from '../constants';
import { BenchDriver } from './bench-driver';

const SMALL = { cells: 12, motes: 30, fragments: 5 };

describe('BenchDriver', () => {
  it('parks the store on the requested tick with the bench cells and motes there', () => {
    const driver = new BenchDriver(RENDER_BENCH_SEED, SMALL);
    driver.goToTick(120);
    const frame = driver.frame()!;
    expect(frame.renderTick).toBeCloseTo(120, 6);
    expect(frame.cells).toHaveLength(SMALL.cells);
    expect(frame.motes).toHaveLength(SMALL.motes);
    expect(frame.fragments).toHaveLength(SMALL.fragments);
    expect(driver.tick).toBe(120);
    expect(driver.store.ownPlayerId).not.toBeNull();
  });

  it('renders the same frame for the same seed and tick, and another for another seed', () => {
    const first = new BenchDriver(RENDER_BENCH_SEED, SMALL);
    first.goToTick(90);
    const second = new BenchDriver(RENDER_BENCH_SEED, SMALL);
    second.goToTick(90);
    expect(second.frame()!.cells).toEqual(first.frame()!.cells);
    second.setSeed(RENDER_BENCH_SEED + 1);
    second.goToTick(90);
    expect(second.frame()!.cells).not.toEqual(first.frame()!.cells);
  });

  it('steps forward, rewinds by replaying from tick 0 and delivers the effects of a stepped tick once', () => {
    const driver = new BenchDriver(RENDER_BENCH_SEED, SMALL);
    driver.goToTick(60);
    driver.frame();
    driver.step(3);
    expect(driver.tick).toBe(63);
    const frame = driver.frame()!;
    expect(frame.renderTick).toBeCloseTo(63, 6);
    expect(frame.effects.length).toBeGreaterThan(0);
    expect(driver.frame()!.effects).toEqual([]);
    driver.goToTick(30);
    expect(driver.frame()!.renderTick).toBeCloseTo(30, 6);
  });
});
