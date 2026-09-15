import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { FACT_SEPARATOR } from './fact-line';
import {
  LEADERBOARD_COMPACT_LABELS,
  LEADERBOARD_FULL_LABELS,
  LEADERBOARD_TEXT,
  leaderboardFooterText,
  leaderboardLabelsFor,
} from './leaderboard-labels';

const BONUS = DEFAULT_BALANCE.session.SCORE_ABSORPTION_BONUS;

function texts(labels: readonly { readonly text: string }[]): string[] {
  return labels.map((label) => label.text);
}

describe('leaderboardLabelsFor', () => {
  it('names the level and score columns on the compact panel, with the hold-Tab hint and no footer', () => {
    const labels = leaderboardLabelsFor({ isFull: false, scoreAbsorptionBonus: BONUS });
    expect(labels.hint).toBe(LEADERBOARD_TEXT.hintClosed);
    expect(texts(labels.columns)).toEqual(['LV', 'SCORE']);
    expect(labels.footer).toBeNull();
  });

  it('adds MASS and ENGULFS on the full list, reads TAB HELD and carries the score rule', () => {
    const labels = leaderboardLabelsFor({ isFull: true, scoreAbsorptionBonus: BONUS });
    expect(labels.hint).toBe(LEADERBOARD_TEXT.hintOpen);
    expect(texts(labels.columns)).toEqual(['LV', 'SCORE', 'MASS', 'ENGULFS']);
    expect(labels.footer).toBe(leaderboardFooterText(BONUS));
  });

  it('extends the compact labels in track order, so each full label keeps its compact column', () => {
    expect(LEADERBOARD_FULL_LABELS.slice(0, LEADERBOARD_COMPACT_LABELS.length)).toEqual(LEADERBOARD_COMPACT_LABELS);
    expect(new Set(LEADERBOARD_FULL_LABELS.map((label) => label.className)).size).toBe(LEADERBOARD_FULL_LABELS.length);
  });

  it('drops the footer until the live balance has arrived rather than typing a bonus', () => {
    expect(leaderboardLabelsFor({ isFull: true, scoreAbsorptionBonus: null }).footer).toBeNull();
  });
});

describe('leaderboardFooterText', () => {
  it('reads the bonus from the balance, formatted', () => {
    const bonus = formatQuantity(BONUS, QUANTITY_UNIT.count);
    expect(leaderboardFooterText(BONUS)).toBe(`SCORE = DNA + ${bonus} PER ENGULF${FACT_SEPARATOR}KEPT ON DEATH`);
  });

  it('follows a retuned bonus', () => {
    expect(leaderboardFooterText(BONUS + 1)).toContain(`+ ${formatQuantity(BONUS + 1, QUANTITY_UNIT.count)} PER`);
  });
});
