import { describe, expect, it } from 'vitest';
import { HEADING_STILL_WU, nextHeading } from './bacterium-heading';

describe('nextHeading', () => {
  it('starts at zero, then points along the displacement and holds when still', () => {
    const first = nextHeading(undefined, 10, 10);
    expect(first.heading).toBe(0);
    const moved = nextHeading(first, 10, 20);
    expect(moved.heading).toBeCloseTo(Math.PI / 2, 9);
    const still = nextHeading(moved, 10, 20 + HEADING_STILL_WU / 2);
    expect(still.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(still.y).toBeCloseTo(20 + HEADING_STILL_WU / 2, 9);
  });
});
