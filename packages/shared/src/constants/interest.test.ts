import { describe, expect, it } from 'vitest';
import { INTEREST_CAMERA_HISTORY_BROADCASTS } from './interest.js';
import { INTERPOLATION_DELAY_TICKS, SNAPSHOT_EVERY_TICKS } from './netcode.js';

// The margin, which depends on the balance, is tested with its formula (`camera/interest-margin.test.ts`).
describe('INTEREST_CAMERA_HISTORY_BROADCASTS', () => {
  it('reaches back past the client’s render delay by one broadcast interval', () => {
    const spannedTicks = (INTEREST_CAMERA_HISTORY_BROADCASTS - 1) * SNAPSHOT_EVERY_TICKS;
    expect(spannedTicks).toBeGreaterThanOrEqual(INTERPOLATION_DELAY_TICKS + SNAPSHOT_EVERY_TICKS);
  });
});
