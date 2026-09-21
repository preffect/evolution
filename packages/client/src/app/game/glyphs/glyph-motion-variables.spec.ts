// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GLYPH_MOTION_AMPLITUDE, GLYPH_PULSE_CEILING } from '../render/constants/trait-glyph-layers';
import { glyphMotionVariables } from './glyph-motion-variables';

describe('glyphMotionVariables', () => {
  it('publishes exactly the amplitudes the keyframes read, each from its constant with its unit', () => {
    expect(glyphMotionVariables()).toEqual({
      '--glyph-breathe-scale': String(GLYPH_MOTION_AMPLITUDE.breatheScale),
      '--glyph-beat-scale': String(GLYPH_MOTION_AMPLITUDE.beatScale),
      '--glyph-sway-angle': `${GLYPH_MOTION_AMPLITUDE.swayDeg}deg`,
      '--glyph-rise-distance': `${GLYPH_MOTION_AMPLITUDE.riseUnits}px`,
    });
  });
});

describe('GLYPH_MOTION_AMPLITUDE', () => {
  it('keeps both pulses above rest and at or under the §5 pulse ceiling', () => {
    for (const scale of [GLYPH_MOTION_AMPLITUDE.breatheScale, GLYPH_MOTION_AMPLITUDE.beatScale]) {
      expect(scale).toBeGreaterThan(1);
      expect(scale).toBeLessThanOrEqual(GLYPH_PULSE_CEILING);
    }
  });

  it('keeps the sway and the rise small: a few degrees and a few units', () => {
    expect(GLYPH_MOTION_AMPLITUDE.swayDeg).toBeGreaterThan(0);
    expect(GLYPH_MOTION_AMPLITUDE.swayDeg).toBeLessThanOrEqual(10);
    expect(GLYPH_MOTION_AMPLITUDE.riseUnits).toBeGreaterThan(0);
    expect(GLYPH_MOTION_AMPLITUDE.riseUnits).toBeLessThanOrEqual(5);
  });
});
