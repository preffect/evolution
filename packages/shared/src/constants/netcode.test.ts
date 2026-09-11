import { describe, expect, it } from 'vitest';
import {
  INTERPOLATION_DELAY_TICKS,
  MAX_EXTRAPOLATION_TICKS,
  SNAPSHOT_BUFFER_SIZE,
  SNAPSHOT_EVERY_TICKS,
} from './netcode.js';

describe('netcode constants', () => {
  it('broadcasts on a whole positive tick cadence', () => {
    expect(Number.isInteger(SNAPSHOT_EVERY_TICKS)).toBe(true);
    expect(SNAPSHOT_EVERY_TICKS).toBeGreaterThanOrEqual(1);
  });

  it('derives the interpolation delay and the buffer from the cadence (docs/ARCHITECTURE.md §5)', () => {
    expect(INTERPOLATION_DELAY_TICKS).toBe(2 * SNAPSHOT_EVERY_TICKS);
    expect(SNAPSHOT_BUFFER_SIZE * SNAPSHOT_EVERY_TICKS).toBeGreaterThan(
      INTERPOLATION_DELAY_TICKS + SNAPSHOT_EVERY_TICKS,
    );
    expect(MAX_EXTRAPOLATION_TICKS).toBeGreaterThan(0);
  });
});
