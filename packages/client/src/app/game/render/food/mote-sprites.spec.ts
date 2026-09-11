import { describe, expect, it } from 'vitest';
import { ALGAE_RADIUS, BACTERIUM_RADIUS, entityId, type FoodMoteView } from '@evolution/shared';
import { MOTE_BREATH_AMPLITUDE, MOTE_CORE_MIN_PX, MOTE_SMALL_VARIANT_MAX_ZOOM } from '../constants';
import { MOTE_SPRITE } from '../textures/mote-atlas';
import { flooredRadiusWu, moteAppearance, moteBreath, moteSpriteKey } from './mote-sprites';

const algae: FoodMoteView = { id: entityId('m-1'), kind: 'algae', bacteriumVariant: null, x: 0, y: 0 };
const rod: FoodMoteView = { id: entityId('m-2'), kind: 'bacterium', bacteriumVariant: 'aerobic', x: 0, y: 0 };

describe('mote sprites', () => {
  it('picks the atlas key by kind and variant', () => {
    expect(moteSpriteKey(algae)).toBe(MOTE_SPRITE.algae);
    expect(moteSpriteKey({ kind: 'detritus', bacteriumVariant: null })).toBe(MOTE_SPRITE.detritus);
    expect(moteSpriteKey(rod)).toBe(MOTE_SPRITE.bacteriumAerobic);
    expect(moteSpriteKey({ kind: 'bacterium', bacteriumVariant: 'photosynthetic' })).toBe(
      MOTE_SPRITE.bacteriumPhotosynthetic,
    );
    expect(moteSpriteKey({ kind: 'bacterium', bacteriumVariant: 'plain' })).toBe(MOTE_SPRITE.bacteriumPlain);
  });

  it('breathes within ±6 % on a per-mote phase, the same every frame', () => {
    const samples = Array.from({ length: 40 }, (_unused, step) => moteBreath('m-7', step * 0.1));
    expect(Math.max(...samples)).toBeLessThanOrEqual(1 + MOTE_BREATH_AMPLITUDE + 1e-9);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(1 - MOTE_BREATH_AMPLITUDE - 1e-9);
    expect(moteBreath('m-7', 1.5)).toBe(moteBreath('m-7', 1.5));
    expect(moteBreath('m-7', 0)).not.toBe(moteBreath('m-8', 0));
  });

  it('floors the core at 2 px and switches to the small variant below zoom 0.5', () => {
    expect(flooredRadiusWu(ALGAE_RADIUS, 1)).toBe(ALGAE_RADIUS);
    expect(flooredRadiusWu(ALGAE_RADIUS, 0.1)).toBe(MOTE_CORE_MIN_PX / 0.1);
    expect(moteAppearance(algae, 0, 0, MOTE_SMALL_VARIANT_MAX_ZOOM - 0.01).isSmallVariant).toBe(true);
    expect(moteAppearance(algae, 0, 0, 1).isSmallVariant).toBe(false);
  });

  it('points a rod along its heading with a tumble and never rotates a mote', () => {
    const appearance = moteAppearance(rod, 1, 0.3, 1);
    expect(Math.abs(appearance.rotation - 1)).toBeLessThan(0.3);
    expect(appearance.rotation).not.toBe(1);
    expect(appearance.bodyRadiusWu).toBeCloseTo(BACTERIUM_RADIUS * moteBreath(rod.id, 0.3), 9);
    expect(appearance.bodyScale).toBeCloseTo(moteBreath(rod.id, 0.3), 9);
    expect(moteAppearance(algae, 1, 0.3, 1).rotation).toBe(0);
  });
});
