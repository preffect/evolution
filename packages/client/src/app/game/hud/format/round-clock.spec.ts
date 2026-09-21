// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, MILLISECONDS_PER_SECOND, ROUND_PHASE } from '@evolution/shared';
import { ROUND_CLOCK_PULSE_LAST_SECONDS } from '../hud-constants';
import { FACT_SEPARATOR } from './fact-line';
import {
  BLOOM_EFFECT_NAME,
  ROUND_CLOCK_CAPTION,
  bloomCaptionText,
  formatRoundClock,
  isRoundInBloom,
  roundClockStateFor,
  roundSecondsLeft,
  type RoundClockInput,
} from './round-clock';

const ROUND_SECONDS = 60;
const BLOOM_FRACTION = DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION;
const FOOD_MULTIPLIER = DEFAULT_BALANCE.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER;
const DNA_MULTIPLIER = DEFAULT_BALANCE.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER;

function inputWithSecondsLeft(secondsLeft: number, overrides: Partial<RoundClockInput> = {}): RoundClockInput {
  return {
    timeLeftMs: secondsLeft * MILLISECONDS_PER_SECOND,
    roundPhase: ROUND_PHASE.playing,
    roundDurationSeconds: ROUND_SECONDS,
    bloomStartFraction: BLOOM_FRACTION,
    foodBloomMultiplier: FOOD_MULTIPLIER,
    dnaFragmentBloomMultiplier: DNA_MULTIPLIER,
    ...overrides,
  };
}

describe('roundSecondsLeft', () => {
  it('floors to whole seconds and never goes negative', () => {
    expect(roundSecondsLeft(9_900)).toBe(9);
    expect(roundSecondsLeft(-500)).toBe(0);
    expect(roundSecondsLeft(null)).toBe(0);
  });
});

describe('formatRoundClock', () => {
  it('reads m:ss with the minutes unpadded and the seconds always two digits', () => {
    expect(formatRoundClock(ROUND_SECONDS * MILLISECONDS_PER_SECOND)).toBe('1:00');
    expect(formatRoundClock(9 * MILLISECONDS_PER_SECOND)).toBe('0:09');
    expect(formatRoundClock(462 * MILLISECONDS_PER_SECOND)).toBe('7:42');
    expect(formatRoundClock(0)).toBe('0:00');
  });

  it('floors a part second rather than rounding it up, so the clock never shows a second it has left', () => {
    expect(formatRoundClock(59_999)).toBe('0:59');
  });
});

/** The last whole second before the bloom, and the first one inside it, on a ROUND_SECONDS round. */
const BLOOM_STARTS_WITH_SECONDS_LEFT = Math.round(ROUND_SECONDS * (1 - BLOOM_FRACTION));

describe('isRoundInBloom', () => {
  it('starts when the round has run past ROUND_BLOOM_START_FRACTION of its length', () => {
    expect(BLOOM_STARTS_WITH_SECONDS_LEFT).toBe(12);
    expect(isRoundInBloom(inputWithSecondsLeft(BLOOM_STARTS_WITH_SECONDS_LEFT + 1))).toBe(false);
    expect(isRoundInBloom(inputWithSecondsLeft(BLOOM_STARTS_WITH_SECONDS_LEFT))).toBe(true);
    expect(isRoundInBloom(inputWithSecondsLeft(0))).toBe(true);
  });

  it('stays false while the round length or the live balance is still unknown', () => {
    expect(isRoundInBloom(inputWithSecondsLeft(0, { roundDurationSeconds: null }))).toBe(false);
    expect(isRoundInBloom(inputWithSecondsLeft(0, { bloomStartFraction: null }))).toBe(false);
    expect(isRoundInBloom(inputWithSecondsLeft(0, { roundDurationSeconds: 0 }))).toBe(false);
  });
});

describe('roundClockStateFor', () => {
  it('shows ROUND in white with no pulse in the body of a round', () => {
    const state = roundClockStateFor(inputWithSecondsLeft(ROUND_SECONDS));
    expect(state).toEqual({
      text: '1:00',
      caption: ROUND_CLOCK_CAPTION.round,
      isBloom: false,
      isPulsing: false,
      isVisible: true,
    });
  });

  it('turns the caption to the bloom and its effect once the bloom has started', () => {
    const state = roundClockStateFor(inputWithSecondsLeft(BLOOM_STARTS_WITH_SECONDS_LEFT));
    expect(state.isBloom).toBe(true);
    expect(state.caption).toBe(bloomCaptionText(FOOD_MULTIPLIER, DNA_MULTIPLIER));
  });

  it('pulses through the last ten seconds and not before', () => {
    expect(roundClockStateFor(inputWithSecondsLeft(ROUND_CLOCK_PULSE_LAST_SECONDS + 1)).isPulsing).toBe(false);
    expect(roundClockStateFor(inputWithSecondsLeft(ROUND_CLOCK_PULSE_LAST_SECONDS)).isPulsing).toBe(true);
  });

  it('names what the bloom multiplies, with the factors from the balance', () => {
    expect(bloomCaptionText(FOOD_MULTIPLIER, DNA_MULTIPLIER)).toBe(
      [
        ROUND_CLOCK_CAPTION.bloom,
        `${BLOOM_EFFECT_NAME.food} ×${FOOD_MULTIPLIER}`,
        `${BLOOM_EFFECT_NAME.dnaFragments} ×${DNA_MULTIPLIER}`,
      ].join(FACT_SEPARATOR),
    );
    // The default balance reads exactly the caption decision #324 chose.
    expect(bloomCaptionText(FOOD_MULTIPLIER, DNA_MULTIPLIER)).toBe('BLOOM · FOOD ×1.5 · DNA DROPS ×2');
  });

  it('reads a bare BLOOM while the multipliers are unknown', () => {
    const state = roundClockStateFor(inputWithSecondsLeft(0, { foodBloomMultiplier: null }));
    expect(state.caption).toBe(ROUND_CLOCK_CAPTION.bloom);
    expect(bloomCaptionText(FOOD_MULTIPLIER, null)).toBe(ROUND_CLOCK_CAPTION.bloom);
  });

  it('hides through the results phase and before the first snapshot', () => {
    expect(roundClockStateFor(inputWithSecondsLeft(0, { roundPhase: ROUND_PHASE.results })).isVisible).toBe(false);
    expect(roundClockStateFor(inputWithSecondsLeft(0, { timeLeftMs: null })).isVisible).toBe(false);
  });
});
