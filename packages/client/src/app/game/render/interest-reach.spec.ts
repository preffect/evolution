// @vitest-environment node
// The server culls food and fragments outside each viewer's interest area (docs/architecture/wire-contract.md §4.2
// lever 1). Its margin counts a mote as `INTEREST_ENTITY_REACH_RADII` of its radius wide, so no mote this renderer
// draws may reach further, or its glow would pop at the edge of the canvas as the mote enters the stream.
import { describe, expect, it } from 'vitest';
import { INTEREST_ENTITY_REACH_RADII } from '@evolution/shared';
import { ALGAE_GLOW, DETRITUS_GLOW } from './constants/world-render';

describe('the server’s interest margin against the drawn food', () => {
  it('counts every food glow as no wider than it is drawn', () => {
    for (const glow of [ALGAE_GLOW, DETRITUS_GLOW]) {
      expect(INTEREST_ENTITY_REACH_RADII).toBeGreaterThanOrEqual(glow.wide);
      expect(INTEREST_ENTITY_REACH_RADII).toBeGreaterThanOrEqual(glow.soft);
    }
  });
});
