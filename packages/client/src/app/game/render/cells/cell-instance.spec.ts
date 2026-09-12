// The instance layout is the one table the packing and the GLSL share (docs/RENDERING.md §2.3):
// every scalar lands in a distinct channel, the bumps fill the row's tail, and the row fits.

import { describe, expect, it } from 'vitest';
import { MAX_SHAPE_BUMPS } from '../constants';
import {
  BUMP_TEXEL_START,
  CELL_INSTANCE_FLOATS,
  CELL_INSTANCE_TEXELS,
  createInstanceBuffer,
  instanceFieldLocation,
  instanceScalarFields,
  packCellInstance,
  type CellInstance,
  type CellInstanceScalar,
} from './cell-instance';
import { ZERO_BUMP } from './radial-profile';

const TEXEL_FLOATS = 4;

const instance: CellInstance = {
  x: 10,
  y: -20,
  radius: 30,
  quadExtentRadii: 3,
  heading: 0.5,
  speedRatio: 0.25,
  paletteIndex: 3,
  lodBlend: 1,
  breathing: 0.01,
  wobbleAmplitude: 0.08,
  wobbleMode: 2,
  wobblePhase: 1.2,
  axialAlong: 1.06,
  axialAcross: 1,
  pulse: 1,
  rimBrightness: 1.2,
  nucleusOffsetX: -0.08,
  nucleusOffsetY: -0.08,
  haloKind: 3,
  beadCount: 4,
  isOwn: true,
  isFarDot: false,
  isProtocell: true,
  alpha: 0.9,
  stripRow: 5,
  stripPhase: 0.3,
  lobesScale: 0.5,
  jitterAmplitude: 0.008,
  ciliaCount: 24,
  wallScale: 1.5,
  speckleDensity: 40,
  filamentCount: 11,
  tintMix: 0.2,
  warningRingPx: 26,
  formId: 1,
  passBAlpha: 0.62,
  rimDash: 1,
  ciliaPhase: 0.4,
  nucleusDiscRadii: 0.3,
  speckleSeed: 0.45,
  bumps: [{ amplitude: 0.62, centre: 0.52, sigma: 0.28 }],
};

/** The §2.3 row: the scalars plus the bump slots fit sixteen texels; a new field takes a free channel, never a texel. */
const INSTANCE_ROW_TEXELS = 16;

function channelOf(row: Float32Array, field: CellInstanceScalar): number {
  const [texel, channel] = instanceFieldLocation(field);
  return row[texel * TEXEL_FLOATS + channel] ?? Number.NaN;
}

describe('packCellInstance', () => {
  it('lays the scalars in table order and the bumps last, in the row asked for', () => {
    expect(CELL_INSTANCE_FLOATS).toBe(CELL_INSTANCE_TEXELS * TEXEL_FLOATS);
    const buffer = createInstanceBuffer(2);
    packCellInstance(buffer, 1, instance);
    expect(buffer.subarray(0, CELL_INSTANCE_FLOATS).every((value) => value === 0)).toBe(true);
    const row = buffer.subarray(CELL_INSTANCE_FLOATS, 2 * CELL_INSTANCE_FLOATS);
    expect([...row.subarray(0, TEXEL_FLOATS)]).toEqual([10, -20, 30, 3]);
    expect(channelOf(row, 'isOwn')).toBe(1);
    expect(channelOf(row, 'isFarDot')).toBe(0);
    expect(channelOf(row, 'isProtocell')).toBe(1);
    expect(channelOf(row, 'alpha')).toBeCloseTo(0.9, 6);
    expect(channelOf(row, 'rimBrightness')).toBeCloseTo(1.2, 6);
    expect(channelOf(row, 'warningRingPx')).toBe(26);
    expect(channelOf(row, 'rimDash')).toBe(1);
    expect(channelOf(row, 'ciliaPhase')).toBeCloseTo(0.4, 6);
    expect(channelOf(row, 'nucleusDiscRadii')).toBeCloseTo(0.3, 6);
    expect(channelOf(row, 'speckleSeed')).toBeCloseTo(0.45, 6);
    const bumpBase = BUMP_TEXEL_START * TEXEL_FLOATS;
    expect([...row.subarray(bumpBase, bumpBase + 3)].map((value) => Math.round(value * 100) / 100)).toEqual([
      0.62, 0.52, 0.28,
    ]);
  });

  it('writes zero-amplitude unit-sigma bumps into the unused slots', () => {
    const buffer = createInstanceBuffer(1);
    packCellInstance(buffer, 0, instance);
    const bumpBase = BUMP_TEXEL_START * TEXEL_FLOATS;
    for (let slot = 1; slot < MAX_SHAPE_BUMPS; slot += 1) {
      expect(buffer[bumpBase + slot * 3]).toBe(ZERO_BUMP.amplitude);
      expect(buffer[bumpBase + slot * 3 + 2]).toBe(ZERO_BUMP.sigma);
    }
    expect(BUMP_TEXEL_START + Math.ceil((MAX_SHAPE_BUMPS * 3) / TEXEL_FLOATS)).toBe(CELL_INSTANCE_TEXELS);
  });

  it('keeps the row at sixteen texels with the nucleus disc and the speckle seed in the last scalar texel (#231, #243)', () => {
    expect(CELL_INSTANCE_TEXELS).toBe(INSTANCE_ROW_TEXELS);
    expect(instanceFieldLocation('nucleusDiscRadii')[0]).toBe(BUMP_TEXEL_START - 1);
    expect(instanceFieldLocation('speckleSeed')[0]).toBe(BUMP_TEXEL_START - 1);
  });

  it('locates every scalar field in a distinct channel and rejects an unknown one', () => {
    const fields = Object.keys(instance).filter((field) => field !== 'bumps') as CellInstanceScalar[];
    const locations = new Set(fields.map((field) => instanceFieldLocation(field).join(':')));
    expect(locations.size).toBe(fields.length);
    expect(new Set(instanceScalarFields())).toEqual(new Set(fields));
    expect(() => instanceFieldLocation('bumps' as CellInstanceScalar)).toThrow(/no texel/);
  });
});
