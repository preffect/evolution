import { describe, expect, it } from 'vitest';
import { FOOD_VACUOLE, MITOCHONDRION, TOXIN_VACUOLE } from '../constants';
import { ORGANELLE_KIND } from './organelle-kinds';
import { organelleMotion } from './organelle-motion';

describe('organelleMotion', () => {
  it('rests every kind at scale 1 and pulses the mitochondrion on sprint', () => {
    expect(organelleMotion(ORGANELLE_KIND.nucleus, 0.3, 5, true)).toEqual({ scale: 1, alpha: 1, lift: 0 });
    expect(organelleMotion(ORGANELLE_KIND.mitochondrion, 0, 0, false).scale).toBe(1);
    expect(organelleMotion(ORGANELLE_KIND.mitochondrion, 0, 0, true).scale).toBe(MITOCHONDRION.sprintScale);
  });

  it('breathes the toxin bladder between 1.0 and 1.08 at 1 Hz', () => {
    const peak = organelleMotion(ORGANELLE_KIND.toxinVacuole, 0, 0.25 / TOXIN_VACUOLE.pulseHz, false).scale;
    const trough = organelleMotion(ORGANELLE_KIND.toxinVacuole, 0, 0.75 / TOXIN_VACUOLE.pulseHz, false).scale;
    expect(peak).toBeCloseTo(TOXIN_VACUOLE.pulseScale, 9);
    expect(trough).toBeCloseTo(1, 9);
  });

  it('rises and pops a food vacuole every cycle', () => {
    const young = organelleMotion(ORGANELLE_KIND.foodVacuole, 0, 0, false);
    const old = organelleMotion(ORGANELLE_KIND.foodVacuole, 0, FOOD_VACUOLE.cycleSeconds * 0.99, false);
    expect(young.scale).toBeLessThan(old.scale);
    expect(old.lift).toBeLessThan(0);
    expect(old.alpha).toBeLessThan(1);
    expect(young.alpha).toBe(1);
    expect(organelleMotion(ORGANELLE_KIND.foodVacuole, 0.5, 0, false).scale).toBeCloseTo(0.75, 9);
  });
});
