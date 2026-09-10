import { describe, expect, it } from 'vitest';
import { TICK_HZ, TICK_INTERVAL_MS } from './network.js';
import { MILLISECONDS_PER_SECOND } from './units.js';

describe('network constants', () => {
  it('derives the tick interval from the tick rate', () => {
    expect(TICK_INTERVAL_MS * TICK_HZ).toBeCloseTo(MILLISECONDS_PER_SECOND);
  });
});
