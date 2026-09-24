// The round clock's every decision (docs/ui/hud.md §3.1.1), as one pure function: what the digits read,
// whether the bloom has started, what the caption says, whether the last-ten-seconds pulse runs and
// whether the clock is shown at all. `round-timer.component.ts` only binds the record this answers.

import { MILLISECONDS_PER_SECOND, ROUND_PHASE, type RoundPhase } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { MULTIPLIER_SIGN, QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { ROUND_CLOCK_PULSE_LAST_SECONDS } from '../hud-constants';
import { joinFacts } from './fact-line';

const NO_TIME_LEFT_MS = 0;

/** The caption under the digits: the round, or the bloom once the rates multiply. */
export const ROUND_CLOCK_CAPTION = { round: 'ROUND', bloom: 'BLOOM' } as const;

/** What the bloom multiplies, as the caption names it (decision #324). */
export const BLOOM_EFFECT_NAME = { food: 'FOOD', dnaFragments: 'DNA DROPS' } as const;

export interface RoundClockInput {
  /** `snapshot.roundTimeLeftMs`; negative or absent reads as zero. */
  readonly timeLeftMs: number | null;
  readonly roundPhase: RoundPhase;
  /** `mp.sessionConfig().roundDurationSeconds`; `null` before the room's config has arrived. */
  readonly roundDurationSeconds: number | null;
  /** `balance.session.ROUND_BLOOM_START_FRACTION`; `null` before the live balance has arrived. */
  readonly bloomStartFraction: number | null;
  /** `balance.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER`; `null` before the live balance has arrived. */
  readonly foodBloomMultiplier: number | null;
  /** `balance.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER`; `null` before the live balance has arrived. */
  readonly dnaFragmentBloomMultiplier: number | null;
}

export interface RoundClockState {
  /** `m:ss`, floored: `1:00` at sixty seconds left, `0:09` at nine. */
  readonly text: string;
  /** `ROUND`, or from the bloom's start (docs/ecology/food-and-spawn.md §3.1) `BLOOM · FOOD ×1.5 · DNA DROPS ×2`. */
  readonly caption: string;
  /** In bloom the digits turn level gold and the caption, which now carries a fact, is set in `label`. */
  readonly isBloom: boolean;
  /** Inside the last ten seconds the clock pulses once per second. */
  readonly isPulsing: boolean;
  /**
   * The results overlay shows its own countdown, so the clock stands down for it (§3.4); before
   * the first snapshot there is no round to show either.
   */
  readonly isVisible: boolean;
}

/** Whole seconds left, floored and never negative: what both the digits and the pulse read. */
export function roundSecondsLeft(timeLeftMs: number | null): number {
  const milliseconds = Math.max(NO_TIME_LEFT_MS, timeLeftMs ?? NO_TIME_LEFT_MS);
  return Math.floor(milliseconds / MILLISECONDS_PER_SECOND);
}

/** `m:ss` with the minutes unpadded and the seconds always two digits, through the `clock` unit. */
export function formatRoundClock(timeLeftMs: number | null): string {
  return formatQuantity(roundSecondsLeft(timeLeftMs), QUANTITY_UNIT.clock);
}

/**
 * `×1.5`: the sign leads, so the effect reads as a factor on the name before it. The bloom row of the hold-Tab
 * panel (docs/ui/overlays.md §3.7) writes the same factors, so the form has one home.
 */
export function leadingMultiplier(multiplier: number): string {
  const figure = formatQuantity(multiplier, QUANTITY_UNIT.multiplier, { presentation: QUANTITY_PRESENTATION.numeral });
  return `${MULTIPLIER_SIGN}${figure}`;
}

/**
 * `BLOOM · FOOD ×1.5 · DNA DROPS ×2`, from the live balance; bare `BLOOM` while the multipliers are
 * unknown rather than a typed factor.
 */
export function bloomCaptionText(
  foodBloomMultiplier: number | null,
  dnaFragmentBloomMultiplier: number | null,
): string {
  if (foodBloomMultiplier === null || dnaFragmentBloomMultiplier === null) return ROUND_CLOCK_CAPTION.bloom;
  return joinFacts([
    ROUND_CLOCK_CAPTION.bloom,
    `${BLOOM_EFFECT_NAME.food} ${leadingMultiplier(foodBloomMultiplier)}`,
    `${BLOOM_EFFECT_NAME.dnaFragments} ${leadingMultiplier(dnaFragmentBloomMultiplier)}`,
  ]);
}

/**
 * Whether the bloom has started: the round has run past `ROUND_BLOOM_START_FRACTION` of its length,
 * which is the same test the server's round clock makes in ticks. Unknowable — no config, no
 * balance, a zero-length round — reads as "not yet" rather than as a gold clock on a fresh round.
 */
export function isRoundInBloom(input: RoundClockInput): boolean {
  const { roundDurationSeconds, bloomStartFraction } = input;
  if (roundDurationSeconds === null || bloomStartFraction === null || roundDurationSeconds <= 0) return false;
  const elapsedFraction = 1 - roundSecondsLeft(input.timeLeftMs) / roundDurationSeconds;
  return elapsedFraction >= bloomStartFraction;
}

export function roundClockStateFor(input: RoundClockInput): RoundClockState {
  const isBloom = isRoundInBloom(input);
  return {
    text: formatRoundClock(input.timeLeftMs),
    caption: isBloom
      ? bloomCaptionText(input.foodBloomMultiplier, input.dnaFragmentBloomMultiplier)
      : ROUND_CLOCK_CAPTION.round,
    isBloom,
    isPulsing: roundSecondsLeft(input.timeLeftMs) <= ROUND_CLOCK_PULSE_LAST_SECONDS,
    isVisible: input.roundPhase === ROUND_PHASE.playing && input.timeLeftMs !== null,
  };
}
