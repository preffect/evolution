import { describe, expect, it } from 'vitest';
import { FakeBakeContext } from '../../../../testing/fake-bake-canvas';
import { VENT_CRUST, VENT_CRUST_ALPHA, VENT_HEAT_POOL_ALPHA, VENT_PLUME, VENT_SEAM_HOT } from '../constants';
import { hexWithAlpha } from '../colour';
import { paintVent } from './vent-bake';

describe('paintVent', () => {
  const context = new FakeBakeContext();
  paintVent(context, 100, 0.5);

  it('paints the heat pool, two crust plates with their rims, the seam and its hot core', () => {
    const heatPool = 1;
    const crust = 2 * 2;
    const seam = 2;
    expect(context.paintCount).toBe(heatPool + crust + seam);
    expect(context.count('ellipse')).toBe(context.paintCount);
  });

  it('opens with the plume-coloured pool and closes on the white-hot seam core', () => {
    expect(context.ops[0]).toBe('beginPath');
    expect(context.fillStyle).toBe(hexWithAlpha(VENT_SEAM_HOT, 1));
    const plume = hexWithAlpha(VENT_PLUME, VENT_HEAT_POOL_ALPHA);
    const crust = hexWithAlpha(VENT_CRUST, VENT_CRUST_ALPHA);
    const recorded = new FakeBakeContext();
    const fills: string[] = [];
    recorded.fill = () => fills.push(recorded.fillStyle as string);
    paintVent(recorded, 100, 0.5);
    expect(fills[0]).toBe(plume);
    expect(fills[1]).toBe(crust);
    expect(fills.at(-1)).toBe(hexWithAlpha(VENT_SEAM_HOT, 1));
  });
});
