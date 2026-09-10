import { describe, expect, it } from 'vitest';
import { TICK_HZ, TICK_INTERVAL_MS, TICK_INTERVAL_S } from './network.js';
import { MILLISECONDS_PER_SECOND } from './units.js';

describe('network constants', () => {
  it('derives the tick interval from the tick rate', () => {
    expect(TICK_INTERVAL_MS * TICK_HZ).toBeCloseTo(MILLISECONDS_PER_SECOND);
  });

  it('derives the tick interval in seconds from the tick rate', () => {
    expect(TICK_INTERVAL_S * TICK_HZ).toBeCloseTo(1);
    expect(TICK_INTERVAL_S * MILLISECONDS_PER_SECOND).toBeCloseTo(TICK_INTERVAL_MS);
  });
});
