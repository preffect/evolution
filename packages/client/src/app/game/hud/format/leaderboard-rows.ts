// What the leaderboard panel shows (docs/ui/hud.md §3.1.1), decided here so the component only binds:
// which rows make the cut, what each one reads, and the rule that the own row is always among them.
// Pure and DOM-free; the panel passes the signals in and renders the records out.

import type { LeaderboardRow, PlayerId, PlayerRosterView } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { truncatePlayerName } from './player-name';

const FIRST_AVATAR_INDEX = 0;
/** A leaderboard cell is the bare figure: the column header names the unit. */
const BARE_FIGURE = { presentation: QUANTITY_PRESENTATION.numeral };
/** The score column holds five digits; a six-digit score shortens to `123k` rather than spill into the mass (#427). */
const COMPACT_FIGURE = { presentation: QUANTITY_PRESENTATION.compact };

/** One rendered row: everything the panel needs, already formatted. */
export interface LeaderboardEntry {
  readonly playerId: PlayerId;
  readonly rank: number;
  /** Cut to `LEADERBOARD_NAME_MAX_CHARS`, so the column never widens. */
  readonly name: string;
  readonly level: number;
  /** `124`: rounded, without a unit. */
  readonly scoreText: string;
  /** `40`: rounded, without a unit. Full list only, but carried always: the panel decides what it shows. */
  readonly massText: string;
  readonly absorptions: number;
  /** The seat's palette and bead count (docs/visual-style/principles-and-palette.md §2). */
  readonly avatarIndex: number;
  /** The viewing player's own row: tinted, and never dropped for being outside the cut. */
  readonly isOwn: boolean;
}

export interface LeaderboardInput {
  readonly rows: readonly LeaderboardRow[];
  readonly players: Readonly<Record<string, PlayerRosterView>>;
  readonly avatarAssignments: Readonly<Record<string, number>>;
  /** `MultiplayerService.playerId()`; `null` before the room names us. */
  readonly ownPlayerId: PlayerId | null;
  /** How many rows fit: compact or full (docs/ui/hud.md §3.1.1). */
  readonly maxRows: number;
}

function entryFor(row: LeaderboardRow, input: LeaderboardInput): LeaderboardEntry {
  return {
    playerId: row.playerId,
    rank: row.rank,
    name: truncatePlayerName(input.players[row.playerId]?.playerName ?? row.playerId),
    level: row.level,
    scoreText: formatQuantity(row.score, QUANTITY_UNIT.points, COMPACT_FIGURE),
    massText: formatQuantity(row.mass, QUANTITY_UNIT.mass, BARE_FIGURE),
    absorptions: row.absorptions,
    avatarIndex: input.avatarAssignments[row.playerId] ?? FIRST_AVATAR_INDEX,
    isOwn: row.playerId === input.ownPlayerId,
  };
}

/**
 * The rows the panel draws, in rank order. The server ranks; this only cuts to the panel's height
 * and applies docs/ui/hud.md §3.1.1's one exception: **the own row is always present** — outside the
 * cut it replaces the last row, so the player's level is legible as text at every rank.
 */
export function leaderboardEntriesFor(input: LeaderboardInput): readonly LeaderboardEntry[] {
  const ranked = [...input.rows].sort((first, second) => first.rank - second.rank);
  const visible = ranked.slice(0, Math.max(0, input.maxRows));
  const ownRow = ranked.find((row) => row.playerId === input.ownPlayerId);
  const isOwnRowVisible = ownRow !== undefined && visible.includes(ownRow);
  const shown =
    ownRow === undefined || isOwnRowVisible || visible.length === 0
      ? visible
      : [...visible.slice(0, visible.length - 1), ownRow];
  return shown.map((row) => entryFor(row, input));
}
