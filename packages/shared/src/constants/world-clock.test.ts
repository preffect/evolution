// Structural pins of the world clock's constants (docs/GAME-DESIGN.md §12, docs/ECOLOGY.md §3.1):
// a default round crosses three whole world levels and the standing band is a proper fraction.

import { describe, expect, it } from 'vitest';
import { ROUND_DURATION_SECONDS } from './session.js';
import { WORLD_LEVEL_SECONDS, WORLD_MASS_GAIN_PER_SECOND, WORLD_STANDING_MASS_TOLERANCE } from './world-clock.js';

/** docs/ECOLOGY.md §3.1: level-ups at 3:00, 6:00 and 9:00 of a 600 s round. */
const WORLD_LEVEL_UPS_PER_DEFAULT_ROUND = 3;
/** docs/ECOLOGY.md §3.1: `worldMass` 620 at 10:00 from a starting mass of 20. */
const WORLD_MASS_GAINED_PER_DEFAULT_ROUND = 600;

describe('world clock constants', () => {
  it('levels the world up three times in a default round', () => {
    expect(Math.floor(ROUND_DURATION_SECONDS / WORLD_LEVEL_SECONDS)).toBe(WORLD_LEVEL_UPS_PER_DEFAULT_ROUND);
  });

  it('gains six hundred mass over a default round', () => {
    expect(WORLD_MASS_GAIN_PER_SECOND * ROUND_DURATION_SECONDS).toBe(WORLD_MASS_GAINED_PER_DEFAULT_ROUND);
  });

  it('keeps the standing band a proper fraction of the world mass', () => {
    expect(WORLD_STANDING_MASS_TOLERANCE).toBeGreaterThan(0);
    expect(WORLD_STANDING_MASS_TOLERANCE).toBeLessThan(1);
  });
});
