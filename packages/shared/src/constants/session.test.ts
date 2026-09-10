// docs/GAME-DESIGN.md §12 (`session.ts`): the seed bound is the unsigned 32-bit range, which is
// why the client's seed draw (`app.component.ts`) reads one unsigned 32-bit value and clamps nothing.

import { describe, expect, it } from 'vitest';
import { ROUND_DURATION_MAX_SECONDS, ROUND_DURATION_MIN_SECONDS, ROUND_DURATION_SECONDS, SEED_MAX } from './session.js';

const UNSIGNED_32_BIT_MAX = 2 ** 32 - 1;

describe('session constants', () => {
  it('SEED_MAX is exactly the largest unsigned 32-bit integer', () => {
    expect(SEED_MAX).toBe(UNSIGNED_32_BIT_MAX);
  });

  it('the default round length sits inside its accepted bounds', () => {
    expect(ROUND_DURATION_SECONDS).toBeGreaterThanOrEqual(ROUND_DURATION_MIN_SECONDS);
    expect(ROUND_DURATION_SECONDS).toBeLessThanOrEqual(ROUND_DURATION_MAX_SECONDS);
  });
});
