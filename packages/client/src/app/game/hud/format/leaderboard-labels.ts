// The words the leaderboard panel prints around its rows (docs/ui/hud.md §3.1.1, decision #324): the header
// hint, the label strip over the columns and the full list's score rule. Pure and DOM-free; the panel binds
// the record this answers. The strip names exactly the numeric columns the panel shows, in track order, so
// a label always sits over the column it names.

import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { joinFacts } from './fact-line';

export const LEADERBOARD_TEXT = {
  title: 'LEADERBOARD',
  /** The compact panel's hint: what opens the full list. */
  hintClosed: 'HOLD TAB',
  /** The full list's hint while it is open. */
  hintOpen: 'TAB HELD',
} as const;

/** One label in the strip, with the class that places it in its column's track. */
export interface LeaderboardColumnLabel {
  readonly text: string;
  readonly className: string;
}

/** The compact panel's two named columns: level and score. */
export const LEADERBOARD_COMPACT_LABELS: readonly LeaderboardColumnLabel[] = [
  { text: 'LV', className: 'label-level' },
  { text: 'SCORE', className: 'label-score' },
];

/** The full list adds mass and the engulf count (the #321 audit: `EATEN` read as food). */
export const LEADERBOARD_FULL_LABELS: readonly LeaderboardColumnLabel[] = [
  ...LEADERBOARD_COMPACT_LABELS,
  { text: 'MASS', className: 'label-mass' },
  { text: 'ENGULFS', className: 'label-absorptions' },
];

export interface LeaderboardLabels {
  readonly hint: string;
  readonly columns: readonly LeaderboardColumnLabel[];
  /** The score rule, on the full list only; `null` compact or before the live balance has arrived. */
  readonly footer: string | null;
}

export interface LeaderboardLabelsInput {
  readonly isFull: boolean;
  /** `balance.session.SCORE_ABSORPTION_BONUS`; `null` before the live balance has arrived. */
  readonly scoreAbsorptionBonus: number | null;
}

/** `SCORE = DNA + 25 PER ENGULF · KEPT ON DEATH`, with the bonus formatted from the live balance. */
export function leaderboardFooterText(scoreAbsorptionBonus: number): string {
  const bonus = formatQuantity(scoreAbsorptionBonus, QUANTITY_UNIT.count);
  return joinFacts([`SCORE = DNA + ${bonus} PER ENGULF`, 'KEPT ON DEATH']);
}

export function leaderboardLabelsFor(input: LeaderboardLabelsInput): LeaderboardLabels {
  const { isFull, scoreAbsorptionBonus } = input;
  return {
    hint: isFull ? LEADERBOARD_TEXT.hintOpen : LEADERBOARD_TEXT.hintClosed,
    columns: isFull ? LEADERBOARD_FULL_LABELS : LEADERBOARD_COMPACT_LABELS,
    footer: isFull && scoreAbsorptionBonus !== null ? leaderboardFooterText(scoreAbsorptionBonus) : null,
  };
}
