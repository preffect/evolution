import { describe, expect, it } from 'vitest';
import { MAX_SHAPE_BUMPS } from '../constants';
import {
  BUMP_TEXEL_START,
  CELL_INSTANCE_FLOATS,
  CELL_INSTANCE_TEXELS,
  createInstanceBuffer,
  instanceFieldLocation,
  packCellInstance,
  type CellInstance,
} from './cell-instance';

const instance: CellInstance = {
  x: 10,
  y: -20,
  radius: 30,
  quadExtentRadii: 3,
  heading: 0.5,
  speedRatio: 0.25,
  paletteIndex: 3,
  lodBlend: 1,
  ciliaCount: 24,
  wallScale: 1.5,
  speckleDensity: 40,
  filamentCount: 11,
  breathing: 0.01,
  wobbleAmplitude: 0.08,
  wobbleMode: 2,
  wobblePhase: 1.2,
  axialAlong: 1.07,
  axialAcross: 0.95,
  pulse: 1.09,
  tintMix: 0.2,
  nucleusOffsetX: -0.08,
  nucleusOffsetY: -0.08,
  haloKind: 1,
  beadCount: 4,
  isOwn: true,
  warningRingPx: 24,
  selfRingFill: 0.5,
  alpha: 0.9,
  stripRow: 5,
  stripPhase: 0.3,
  rimBrightness: 1.2,
  passBAlpha: 0.62,
  isFarDot: false,
  isProtocell: true,
  ciliaBeatHz: 2,
  haloRadiiScale: 1.5,
  lobesScale: 0.5,
  jitterAmplitude: 0.008,
  rimDash: 0,
  bumps: [{ amplitude: 0.62, centre: 0.52, sigma: 0.28 }],
};

describe('packCellInstance', () => {
  it('lays twenty texels per instance with the scalars in table order and the bumps last', () => {
    expect(CELL_INSTANCE_FLOATS).toBe(CELL_INSTANCE_TEXELS * 4);
    const buffer = createInstanceBuffer(2);
    packCellInstance(buffer, 1, instance);
    const row = buffer.subarray(CELL_INSTANCE_FLOATS, 2 * CELL_INSTANCE_FLOATS);
    expect([...row.subarray(0, 4)]).toEqual([10, -20, 30, 3]);
    expect(row[instanceFieldLocation('isOwn')[0] * 4 + instanceFieldLocation('isOwn')[1]]).toBe(1);
    expect(row[instanceFieldLocation('isFarDot')[0] * 4 + instanceFieldLocation('isFarDot')[1]]).toBe(0);
    expect(row[instanceFieldLocation('passBAlpha')[0] * 4 + instanceFieldLocation('passBAlpha')[1]]).toBeCloseTo(
      0.62,
      6,
    );
    const bumpBase = BUMP_TEXEL_START * 4;
    expect([...row.subarray(bumpBase, bumpBase + 3)].map((value) => Math.round(value * 100) / 100)).toEqual([
      0.62, 0.52, 0.28,
    ]);
    expect(row[bumpBase + 3]).toBe(0);
    expect(row[bumpBase + 5]).toBe(1);
    expect(BUMP_TEXEL_START + Math.ceil((MAX_SHAPE_BUMPS * 3) / 4)).toBeLessThanOrEqual(CELL_INSTANCE_TEXELS);
  });

  it('locates every scalar field in a distinct channel', () => {
    const fields = Object.keys(instance).filter((field) => field !== 'bumps') as (keyof CellInstance)[];
    const locations = new Set(fields.map((field) => instanceFieldLocation(field).join(':')));
    expect(locations.size).toBe(fields.length);
    expect(instanceFieldLocation('bumps')).toEqual([BUMP_TEXEL_START, 0]);
  });
});
