// What the round results screen says (docs/ui/overlays.md §3.4), decided here so the component only binds: who won,
// the whole ranking, and how long until the next round. Pure and DOM-free.

import { ROUND_PHASE, TICK_HZ, secondsToTicks, type GameSessionConfig, type GameSnapshot } from '@evolution/shared';
import { leaderboardEntriesFor, type LeaderboardEntry, type LeaderboardSource } from './leaderboard-rows';

export const RESULTS_TEXT = {
  title: 'ROUND OVER',
  ownWin: 'You win',
  /** The countdown before the room's config or balance has arrived. */
  countdownUnknown: 'Next round soon',
  leave: 'Leave to lobby',
} as const;

/** The countdown's floor: the last tick of the phase would otherwise read `0 s` while the room still waits. */
const LAST_SECOND = 1;

export interface ResultsInput extends LeaderboardSource {
  /** The newest snapshot's tick. */
  readonly tick: number;
  /** `GameStateService.resultsStartedAtTick`; `null` before the room's config has arrived. */
  readonly resultsStartedAtTick: number | null;
  /** `balance.session.RESULTS_SCREEN_SECONDS`; `null` before the live balance has arrived. */
  readonly resultsScreenSeconds: number | null;
}

export interface ResultsWinner {
  /** `Amoeboid wins` (the name cut as everywhere else), or `You win`. */
  readonly text: string;
  readonly avatarIndex: number;
}

export interface ResultsLines {
  /** The top-ranked player; `null` for an empty room. */
  readonly winner: ResultsWinner | null;
  /** Every player, in rank order, the own row flagged for its tint. */
  readonly rows: readonly LeaderboardEntry[];
  /** `Next round in 17 s`, or `Next round soon` when the phase's length is not known yet. */
  readonly countdown: string;
}

/**
 * The tick the results phase began: the round's start plus its length, which is the tick the server's round clock flips
 * on (`round-clock.ts`), so a client that joins mid-results counts down as exactly as one that watched the round end.
 * `null` while playing, or before the room's config has arrived.
 */
export function resultsStartedAtTickFor(
  snapshot: GameSnapshot | null,
  config: GameSessionConfig | null,
): number | null {
  if (snapshot?.roundPhase !== ROUND_PHASE.results || config === null) return null;
  return snapshot.roundStartTick + secondsToTicks(config.roundDurationSeconds);
}

function winnerFor(winner: LeaderboardEntry | undefined): ResultsWinner | null {
  if (winner === undefined) return null;
  return { text: winner.isOwn ? RESULTS_TEXT.ownWin : `${winner.name} wins`, avatarIndex: winner.avatarIndex };
}

function countdownFor(input: ResultsInput): string {
  const { tick, resultsStartedAtTick, resultsScreenSeconds } = input;
  if (resultsStartedAtTick === null || resultsScreenSeconds === null) return RESULTS_TEXT.countdownUnknown;
  const ticksLeft = resultsStartedAtTick + secondsToTicks(resultsScreenSeconds) - tick;
  return `Next round in ${Math.max(LAST_SECOND, Math.ceil(ticksLeft / TICK_HZ))} s`;
}

export function resultsLinesFor(input: ResultsInput): ResultsLines {
  const rows = leaderboardEntriesFor({ ...input, maxRows: input.rows.length });
  return { winner: winnerFor(rows[0]), rows, countdown: countdownFor(input) };
}
