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
  /** The full list's hint while Tab holds it open. */
  hintOpen: 'TAB HELD',
  /** The full list's hint after the header opened it: no key is held, so it says how it closes. */
  hintClicked: 'CLICK TO CLOSE',
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
  /**
   * The full columns and footer are drawn (#615): false while the panel is still widening to the full list, so its
   * header already says how it is held open while the rows keep the compact columns. `isFull` when absent.
   */
  readonly isFullLayout?: boolean;
  readonly isFull: boolean;
  /** The header opened the full list rather than a held Tab. */
  readonly isPinned: boolean;
  /** `balance.session.SCORE_ABSORPTION_BONUS`; `null` before the live balance has arrived. */
  readonly scoreAbsorptionBonus: number | null;
}

/**
 * `Score = DNA + 25 per engulf · kept on death`, with the bonus formatted from the live balance. Mixed case at
 * `label` size (docs/visual-style/ui-type.md §7): uppercase overran the full list's content box.
 */
export function leaderboardFooterText(scoreAbsorptionBonus: number): string {
  const bonus = formatQuantity(scoreAbsorptionBonus, QUANTITY_UNIT.count);
  return joinFacts([`Score = DNA + ${bonus} per engulf`, 'kept on death']);
}

/** `HOLD TAB` on the compact panel; on the full list, how it is being kept open. */
function leaderboardHintFor(isFull: boolean, isPinned: boolean): string {
  if (!isFull) return LEADERBOARD_TEXT.hintClosed;
  return isPinned ? LEADERBOARD_TEXT.hintClicked : LEADERBOARD_TEXT.hintOpen;
}

export function leaderboardLabelsFor(input: LeaderboardLabelsInput): LeaderboardLabels {
  const { isFull, isPinned, scoreAbsorptionBonus } = input;
  const isFullLayout = input.isFullLayout ?? isFull;
  return {
    hint: leaderboardHintFor(isFull, isPinned),
    columns: isFullLayout ? LEADERBOARD_FULL_LABELS : LEADERBOARD_COMPACT_LABELS,
    footer: isFullLayout && scoreAbsorptionBonus !== null ? leaderboardFooterText(scoreAbsorptionBonus) : null,
  };
}
