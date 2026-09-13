// The round clock's every decision (docs/UI.md §3.1.1), as one pure function: what the digits read,
// whether the bloom has started, whether the last-ten-seconds pulse runs and whether the clock is
// shown at all. `round-timer.component.ts` only binds the record this answers.

import { MILLISECONDS_PER_SECOND, ROUND_PHASE, SECONDS_PER_MINUTE, type RoundPhase } from '@evolution/shared';
import { ROUND_CLOCK_PULSE_LAST_SECONDS } from '../hud-constants';

const NO_TIME_LEFT_MS = 0;
const SECONDS_PAD_LENGTH = 2;
const SECONDS_PAD_CHARACTER = '0';

/** The caption under the digits: the round, or the bloom once the rates multiply. */
export const ROUND_CLOCK_CAPTION = { round: 'ROUND', bloom: 'BLOOM' } as const;

export interface RoundClockInput {
  /** `snapshot.roundTimeLeftMs`; negative or absent reads as zero. */
  readonly timeLeftMs: number | null;
  readonly roundPhase: RoundPhase;
  /** `mp.sessionConfig().roundDurationSeconds`; `null` before the room's config has arrived. */
  readonly roundDurationSeconds: number | null;
  /** `balance.session.ROUND_BLOOM_START_FRACTION`; `null` before the live balance has arrived. */
  readonly bloomStartFraction: number | null;
}

export interface RoundClockState {
  /** `m:ss`, floored: `1:00` at sixty seconds left, `0:09` at nine. */
  readonly text: string;
  /** `ROUND`, or `BLOOM` from the bloom's start (docs/ECOLOGY.md §3.1). */
  readonly caption: string;
  /** In bloom the digits turn level gold. */
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

/** `m:ss` with the minutes unpadded and the seconds always two digits. */
export function formatRoundClock(timeLeftMs: number | null): string {
  const secondsLeft = roundSecondsLeft(timeLeftMs);
  const minutes = Math.floor(secondsLeft / SECONDS_PER_MINUTE);
  const seconds = secondsLeft % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(SECONDS_PAD_LENGTH, SECONDS_PAD_CHARACTER)}`;
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
    caption: isBloom ? ROUND_CLOCK_CAPTION.bloom : ROUND_CLOCK_CAPTION.round,
    isBloom,
    isPulsing: roundSecondsLeft(input.timeLeftMs) <= ROUND_CLOCK_PULSE_LAST_SECONDS,
    isVisible: input.roundPhase === ROUND_PHASE.playing && input.timeLeftMs !== null,
  };
}
