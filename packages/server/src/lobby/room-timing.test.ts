import { describe, expect, it } from 'vitest';
import { SystemClock } from '@evolution/shared';
import { createSystemRoomTiming } from './room-timing.js';
import { IntervalTicker } from './ticker.js';

describe('createSystemRoomTiming', () => {
  it('pairs the system clock with a fresh interval ticker per room', () => {
    const first = createSystemRoomTiming();
    const second = createSystemRoomTiming();
    expect(first.clock).toBeInstanceOf(SystemClock);
    expect(first.ticker).toBeInstanceOf(IntervalTicker);
    expect(first.ticker).not.toBe(second.ticker);
  });
});
