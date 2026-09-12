import { describe, expect, it } from 'vitest';
import { ALGAE_RADIUS, BACTERIUM_RADIUS, createSeededRandom, entityId } from '@evolution/shared';
import { createTestFoodMoteView } from '../../../../testing/builders';
import {
  ALGAE_GLOW,
  MOTE_BREATH_AMPLITUDE,
  MOTE_BREATH_HZ_MAX,
  MOTE_BREATH_HZ_MIN,
  MOTE_CORE_MIN_PX,
  MOTE_SMALL_VARIANT_MAX_ZOOM,
  MOTE_WIDE_HALO_MIN_PX,
} from '../constants';
import { MOTE_SPRITE } from '../textures/mote-atlas';
import { drawMoteCosmetics, flooredRadiusWu, moteAppearance, moteBreath, moteSpriteKey } from './mote-sprites';

const algae = createTestFoodMoteView({ id: entityId('m-1') });
const rod = createTestFoodMoteView({ id: entityId('m-2'), kind: 'bacterium', bacteriumVariant: 'aerobic' });
const cosmetics = { breathHz: 0.5, breathPhase: 0.25, tumblePhase: 0 };

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

  it('draws each mote its own breath rate and phases from the cosmetic stream, the same for the same seed', () => {
    const first = drawMoteCosmetics(createSeededRandom(7), entityId('m-1'));
    const again = drawMoteCosmetics(createSeededRandom(7), entityId('m-1'));
    const other = drawMoteCosmetics(createSeededRandom(7), entityId('m-2'));
    expect(first).toEqual(again);
    expect(first).not.toEqual(other);
    expect(first.breathHz).toBeGreaterThanOrEqual(MOTE_BREATH_HZ_MIN);
    expect(first.breathHz).toBeLessThanOrEqual(MOTE_BREATH_HZ_MAX);
    expect(first.breathPhase).toBeGreaterThanOrEqual(0);
    expect(first.breathPhase).toBeLessThan(1);
  });

  it('breathes within ±6 % at its rate: a quarter phase is the peak', () => {
    const samples = Array.from({ length: 40 }, (_unused, step) => moteBreath(cosmetics, step * 0.1));
    expect(Math.max(...samples)).toBeLessThanOrEqual(1 + MOTE_BREATH_AMPLITUDE + 1e-9);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(1 - MOTE_BREATH_AMPLITUDE - 1e-9);
    expect(moteBreath(cosmetics, 0)).toBeCloseTo(1 + MOTE_BREATH_AMPLITUDE, 9);
    expect(moteBreath(cosmetics, 1)).toBeCloseTo(1 - MOTE_BREATH_AMPLITUDE, 9);
  });

  it('floors the core at 2 px and the wide halo at 6 px, and switches to the small variant below zoom 0.5', () => {
    expect(flooredRadiusWu(MOTE_SPRITE.algae, 1)).toBe(ALGAE_RADIUS);
    expect(flooredRadiusWu(MOTE_SPRITE.algae, 0.1)).toBeCloseTo(
      Math.max(MOTE_CORE_MIN_PX / 0.1, MOTE_WIDE_HALO_MIN_PX / (ALGAE_GLOW.wide * 0.1)),
      9,
    );
    const zoom = 0.2;
    expect(flooredRadiusWu(MOTE_SPRITE.bacteriumPlain, zoom) * zoom).toBeGreaterThanOrEqual(MOTE_CORE_MIN_PX);
    const small = moteAppearance({
      mote: algae,
      cosmetics,
      heading: 0,
      timeSeconds: 0,
      zoom: MOTE_SMALL_VARIANT_MAX_ZOOM - 0.01,
    });
    expect(small.isSmallVariant).toBe(true);
    expect(moteAppearance({ mote: algae, cosmetics, heading: 0, timeSeconds: 0, zoom: 1 }).isSmallVariant).toBe(false);
  });

  it('points a rod along its heading with a tumble and never rotates a mote', () => {
    const appearance = moteAppearance({ mote: rod, cosmetics, heading: 1, timeSeconds: 0.3, zoom: 1 });
    expect(Math.abs(appearance.rotation - 1)).toBeLessThan(0.3);
    expect(appearance.rotation).not.toBe(1);
    expect(appearance.bodyRadiusWu).toBeCloseTo(BACTERIUM_RADIUS * moteBreath(cosmetics, 0.3), 9);
    expect(appearance.bodyScale).toBeCloseTo(moteBreath(cosmetics, 0.3), 9);
    expect(moteAppearance({ mote: algae, cosmetics, heading: 1, timeSeconds: 0.3, zoom: 1 }).rotation).toBe(0);
  });
});
