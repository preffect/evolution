// The predation measurement of ticket #376 (#119 item 3, docs/testing/bots-and-design-tables.md §8.3): it folds the
// world's `cell_absorbed` and `cell_released` effects into absorptions per round phase and the engulfs that ended
// `escaped`, so `bench/predation.ts` can report how often a `hunter` catches an alert `forager`. Only engulfs of a
// player's cell count (a wild cell eating a wild cell is the ecology, not predation between players); who the
// predator was is kept per role. An engulf counts as started when it ends, absorbed or released for any reason.

import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ROUND_DURATION_SECONDS,
  SECONDS_PER_MINUTE,
  ENGULF_RELEASE_REASON,
  type CellAbsorbedEffect,
  type CellReleasedEffect,
  type EntityId,
  type GameEffect,
} from '@evolution/shared';

/**
 * The round phases of docs/game-design/session.md §5.1, each with the round second it ends on in a default round: Dawn
 * and Trip are the #138 pace model's times; the Hunt ends where the bloom starts.
 */
export const ROUND_PHASE_ENDS_SECONDS = {
  dawn: 180,
  trip: 270,
  hunt: ROUND_DURATION_SECONDS * DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION,
  bloom: ROUND_DURATION_SECONDS,
} as const;

export type RoundPhase = keyof typeof ROUND_PHASE_ENDS_SECONDS;
export const ROUND_PHASES = Object.keys(ROUND_PHASE_ENDS_SECONDS) as RoundPhase[];

/** Who a cell belongs to: a bot strategy's name, or `wild` for a cell no player owns. */
export const WILD_ROLE = 'wild';
/** A player cell whose player is not one of the measured bots. */
export const UNSEATED_ROLE = 'unseated';
/** A cell the caller never saw before the effect named it. */
export const UNSEEN_ROLE = 'unseen';

/** The round phase a round second falls in, or `undefined` once the round is over. */
export function roundPhaseAt(roundSeconds: number): RoundPhase | undefined {
  return ROUND_PHASES.find((phase) => roundSeconds < ROUND_PHASE_ENDS_SECONDS[phase]);
}

/** A phase's length in minutes: what a count in it is divided by for a rate. */
export function roundPhaseMinutes(phase: RoundPhase): number {
  const index = ROUND_PHASES.indexOf(phase);
  const previous = index === 0 ? 0 : ROUND_PHASE_ENDS_SECONDS[ROUND_PHASES[index - 1]!];
  return (ROUND_PHASE_ENDS_SECONDS[phase] - previous) / SECONDS_PER_MINUTE;
}

export interface PhaseCounts {
  absorbed: number;
  started: number;
  escaped: number;
}

export interface PredationTally {
  readonly byPhase: Record<RoundPhase, PhaseCounts>;
  /** The same counts per predator and prey role, keyed `predatorRole>preyRole`. */
  readonly byRoles: Map<string, Record<RoundPhase, PhaseCounts>>;
}

/** What the tally needs from the world: the role of the cell with this id (a released prey or any predator). */
export type CellRoleOf = (cellId: EntityId) => string;

function emptyCounts(): PhaseCounts {
  return { absorbed: 0, started: 0, escaped: 0 };
}

function emptyPhaseCounts(): Record<RoundPhase, PhaseCounts> {
  return { dawn: emptyCounts(), trip: emptyCounts(), hunt: emptyCounts(), bloom: emptyCounts() };
}

export function createPredationTally(): PredationTally {
  return { byPhase: emptyPhaseCounts(), byRoles: new Map() };
}

/** This phase's counts of the effect's predator role on its prey role, created on first use. */
function roleCountsOf(
  tally: PredationTally,
  phase: RoundPhase,
  effect: CellAbsorbedEffect | CellReleasedEffect,
  roleOf: CellRoleOf,
): PhaseCounts {
  const key = `${roleOf(effect.predatorCellId)}>${roleOf(effect.cellId)}`;
  const counts = tally.byRoles.get(key) ?? emptyPhaseCounts();
  tally.byRoles.set(key, counts);
  return counts[phase];
}

function countEngulfEnd(countsList: readonly PhaseCounts[], isAbsorbed: boolean, isEscaped: boolean): void {
  for (const counts of countsList) {
    counts.started += 1;
    counts.absorbed += isAbsorbed ? 1 : 0;
    counts.escaped += isEscaped ? 1 : 0;
  }
}

/**
 * Folds one tick's effects at `roundSeconds` into the tally. `roleOf` must answer for the absorbed prey too, which
 * is gone from the world by the time the effect is read: the caller remembers the roles of the cells it has seen.
 */
export function tallyEffects(
  tally: PredationTally,
  effects: readonly GameEffect[],
  roundSeconds: number,
  roleOf: CellRoleOf,
): void {
  const phase = roundPhaseAt(roundSeconds);
  if (phase === undefined) {
    return;
  }
  const counts = tally.byPhase[phase];
  for (const effect of effects) {
    if (effect.kind === EFFECT_KIND.cellAbsorbed && effect.playerId !== null) {
      countEngulfEnd([counts, roleCountsOf(tally, phase, effect, roleOf)], true, false);
    } else if (effect.kind === EFFECT_KIND.cellReleased && roleOf(effect.cellId) !== WILD_ROLE) {
      const isEscaped = effect.reason === ENGULF_RELEASE_REASON.escaped;
      countEngulfEnd([counts, roleCountsOf(tally, phase, effect, roleOf)], false, isEscaped);
    }
  }
}
