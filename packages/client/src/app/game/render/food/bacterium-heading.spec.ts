import { describe, expect, it } from 'vitest';
import { BACTERIUM_HEADING_STILL_WU } from '../constants';
import { nextHeading } from './bacterium-heading';

describe('nextHeading', () => {
  it('starts at zero, then points along the displacement and holds when still', () => {
    const first = nextHeading(null, 10, 10);
    expect(first).toEqual({ x: 10, y: 10, heading: 0 });
    const moved = nextHeading(first, 10, 20);
    expect(moved.heading).toBeCloseTo(Math.PI / 2, 9);
    const still = nextHeading(moved, 10, 20 + BACTERIUM_HEADING_STILL_WU / 2);
    expect(still.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(still.y).toBeCloseTo(20 + BACTERIUM_HEADING_STILL_WU / 2, 9);
    expect(nextHeading(still, 0, still.y).heading).toBeCloseTo(Math.PI, 9);
  });
});
