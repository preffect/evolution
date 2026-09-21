// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, MASS_RATE_CAUSE, ZONE_ID, type MassFlowView } from '@evolution/shared';
import { RATE_TAG_MIN_MASS_PER_SECOND, RATE_TAG_ROWS_MAX } from '../../render/constants';
import { CUE_RIM, formatMassAmount, formatMassRate, formatUnsignedMassRate, rateTagsFor } from './mass-cues';

const MITOCHONDRION_I = [{ traitId: 'mitochondrion', tier: 1 }] as const;

function flow(overrides: Partial<MassFlowView> = {}): MassFlowView {
  return { ratesPerSecond: {}, zone: ZONE_ID.openBroth, ...overrides };
}

describe('formatMassAmount / formatMassRate', () => {
  it('writes one decimal under ten and whole figures from ten up, with the typographic minus', () => {
    expect(formatMassAmount(3)).toBe('+3');
    expect(formatMassAmount(2.5)).toBe('+2.5');
    expect(formatMassAmount(-16)).toBe('−16');
    expect(formatMassRate(-0.496)).toBe('−0.5/s');
    expect(formatMassRate(-9.36)).toBe('−9.4/s');
    expect(formatMassRate(-12.4)).toBe('−12/s');
    expect(formatMassRate(0.3)).toBe('+0.3/s');
  });

  it('rounds a figure that reaches ten on rounding to a whole one', () => {
    expect(formatMassRate(-9.96)).toBe('−10/s');
  });

  it('leaves the chip rate unsigned: the trend glyph carries the direction', () => {
    expect(formatUnsignedMassRate(-9.36)).toBe('9.4/s');
  });
});

describe('rateTagsFor', () => {
  it('shows nothing without mass-flow facts (spectating, or before the first metabolism step)', () => {
    expect(rateTagsFor(null, [], DEFAULT_BALANCE)).toEqual([]);
  });

  it('orders the audit worked example largest first and reads every rate from the server', () => {
    // Mass 312 in the vent with Mitochondrion I, touching Toxin Vacuole I (docs/ui/hud.md §3.1.5).
    const toxin = -312 * DEFAULT_BALANCE.traits.TRAIT_TIERS.toxin_vacuole[0]!.toxinDrainFractionPerSecond!;
    const massFlow = flow({
      ratesPerSecond: { decay: -0.5, vent: -0.25, toxin: Number(toxin.toFixed(2)) },
      decayTraitShare: -0.15,
      zone: ZONE_ID.warmVent,
    });
    const tags = rateTagsFor(massFlow, MITOCHONDRION_I, DEFAULT_BALANCE);
    expect(tags.map((tag) => [tag.rateText, tag.causeLabel, tag.rim])).toEqual([
      ['−9.4/s', 'Toxin', CUE_RIM.danger],
      ['−0.5/s', 'Decay', CUE_RIM.none],
      ['−0.3/s', 'Vent', CUE_RIM.warmVent],
    ]);
    expect(tags[1]?.traitShare).toEqual({ traitId: 'mitochondrion', text: '×0.85' });
    expect(tags[0]?.traitShare).toBeNull();
  });

  it(`drops a cause under ${RATE_TAG_MIN_MASS_PER_SECOND}/s and caps the column at ${RATE_TAG_ROWS_MAX}`, () => {
    const massFlow = flow({ ratesPerSecond: { toxin: -2, swallowed: -3, decay: -1, vent: -0.5, light: 0.09 } });
    const tags = rateTagsFor(massFlow, [], DEFAULT_BALANCE);
    expect(tags.map((tag) => tag.cause)).toEqual([
      MASS_RATE_CAUSE.swallowed,
      MASS_RATE_CAUSE.toxin,
      MASS_RATE_CAUSE.decay,
    ]);
  });

  it('breaks a tie in MASS_RATE_CAUSE order and rims light in the shallows tint', () => {
    const tags = rateTagsFor(flow({ ratesPerSecond: { light: 0.3, decay: -0.3 } }), [], DEFAULT_BALANCE);
    expect(tags.map((tag) => [tag.cause, tag.rim])).toEqual([
      [MASS_RATE_CAUSE.decay, CUE_RIM.none],
      [MASS_RATE_CAUSE.light, CUE_RIM.sunlitShallows],
    ]);
  });

  it('names the owned trait that cuts decay the most on the DECAY tag', () => {
    const traits = [
      { traitId: 'chloroplast', tier: 1 },
      { traitId: 'mitochondrion', tier: 1 },
    ] as const;
    const massFlow = flow({ ratesPerSecond: { decay: -0.4 }, decayTraitShare: -0.235 });
    expect(rateTagsFor(massFlow, traits, DEFAULT_BALANCE)[0]?.traitShare).toEqual({
      traitId: 'mitochondrion',
      text: '×0.77',
    });
  });

  it('shows no trait share when the wire carries none', () => {
    const tags = rateTagsFor(flow({ ratesPerSecond: { decay: -0.4 } }), MITOCHONDRION_I, DEFAULT_BALANCE);
    expect(tags[0]?.traitShare).toBeNull();
  });

  it('says nothing when the folded share is not a cut, rather than crediting a trait with an increase', () => {
    const massFlow = flow({ ratesPerSecond: { decay: -0.4 }, decayTraitShare: 0.15 });
    expect(rateTagsFor(massFlow, MITOCHONDRION_I, DEFAULT_BALANCE)[0]?.traitShare).toBeNull();
  });
});
