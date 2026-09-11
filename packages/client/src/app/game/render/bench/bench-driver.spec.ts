import { describe, expect, it } from 'vitest';
import { RENDER_BENCH_SEED } from '../constants';
import { BenchDriver } from './bench-driver';

const SMALL = { cells: 12, motes: 30, fragments: 5 };

describe('BenchDriver', () => {
  it('parks the store on the requested tick with the bench cells interpolated there', () => {
    const driver = new BenchDriver(RENDER_BENCH_SEED, SMALL);
    driver.goToTick(120);
    const frame = driver.frame()!;
    expect(frame.renderTick).toBeCloseTo(120, 6);
    expect(frame.cells).toHaveLength(SMALL.cells);
    expect(frame.motes).toHaveLength(SMALL.motes);
    expect(driver.tick).toBe(120);
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

  it('steps forward and rewinds by replaying from tick 0', () => {
    const driver = new BenchDriver(RENDER_BENCH_SEED, SMALL);
    driver.goToTick(60);
    driver.step(3);
    expect(driver.tick).toBe(63);
    expect(driver.frame()!.renderTick).toBeCloseTo(63, 6);
    driver.goToTick(30);
    expect(driver.frame()!.renderTick).toBeCloseTo(30, 6);
  });
});
