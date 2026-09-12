import { describe, expect, it } from 'vitest';
import { BACTERIUM_HEADING_STILL_WU } from '../constants';
import { advanceHeading, createHeadingMemory } from './bacterium-heading';

describe('advanceHeading', () => {
  it('starts at zero, then points along the displacement and holds when still, in place', () => {
    const memory = createHeadingMemory();
    advanceHeading(memory, 10, 10);
    expect(memory).toEqual({ x: 10, y: 10, heading: 0, hasPosition: true });
    advanceHeading(memory, 10, 20);
    expect(memory.heading).toBeCloseTo(Math.PI / 2, 9);
    advanceHeading(memory, 10, 20 + BACTERIUM_HEADING_STILL_WU / 2);
    expect(memory.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(memory.y).toBeCloseTo(20 + BACTERIUM_HEADING_STILL_WU / 2, 9);
    advanceHeading(memory, 0, memory.y);
    expect(memory.heading).toBeCloseTo(Math.PI, 9);
  });
});
