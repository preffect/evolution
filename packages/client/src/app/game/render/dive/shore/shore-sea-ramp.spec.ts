// @vitest-environment node
// The water by distance to the coast (docs/rendering/opening-dive.md §4): the deep far out, the shallows' strokes
// toward the waterline, and the floor's share, tabulated a quarter cell apart.

import { describe, expect, it } from 'vitest';
import { SHORE_DEPTH_MASK, SHORE_RAMP_TABLE } from '../../constants/dive-shore';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { CHANNEL_MAX } from '../../colour';
import { rgb255 } from './shore-pixels';
import { shoreSeaRamp } from './shore-sea-ramp';

const RGBA = 4;

describe('shoreSeaRamp', () => {
  const ramp = shoreSeaRamp({ strokeReachM: 9000, cellM: 0.5, farthestM: 120 });

  it('is a quarter cell a step, out to the farthest sea', () => {
    expect(ramp.stepM).toBe(0.5 / SHORE_RAMP_TABLE.entriesPerCell);
    expect((ramp.entries - 1) * ramp.stepM).toBeGreaterThanOrEqual(120);
  });

  it('shows the most floor at the waterline, every depth stroke over it', () => {
    const atWaterline = (ramp.bytes[3] ?? 0) / CHANNEL_MAX;
    expect(atWaterline).toBeCloseTo(1 - (1 - SHORE_DEPTH_MASK.share) ** SHORE_DEPTH_MASK.halfWidthsM.length, 2);
    const last = (ramp.entries - 1) * RGBA;
    expect(ramp.bytes[last + 3]).toBe(0);
  });

  it('is lighter and greener at the waterline than out in the deep', () => {
    const deep = rgb255(SHORE_PALETTE.seaDeep);
    expect(ramp.bytes[1]).toBeGreaterThan(deep[1]);
  });

  it('caps the strokes at the reach a level allows, and the entries at the table’s size', () => {
    const capped = shoreSeaRamp({ strokeReachM: 20, cellM: 0.001, farthestM: 1e6 });
    expect(capped.entries).toBe(SHORE_RAMP_TABLE.maxEntries);
    expect(capped.stepM).toBeGreaterThan(0.001 / SHORE_RAMP_TABLE.entriesPerCell);
  });
});
