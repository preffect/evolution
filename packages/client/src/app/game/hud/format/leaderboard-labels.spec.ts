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
    const labels = leaderboardLabelsFor({ isFull: false, isPinned: false, scoreAbsorptionBonus: BONUS });
    expect(labels.hint).toBe(LEADERBOARD_TEXT.hintClosed);
    expect(texts(labels.columns)).toEqual(['LV', 'SCORE']);
    expect(labels.footer).toBeNull();
  });

  it('adds MASS and ENGULFS on the full list, reads TAB HELD and carries the score rule', () => {
    const labels = leaderboardLabelsFor({ isFull: true, isPinned: false, scoreAbsorptionBonus: BONUS });
    expect(labels.hint).toBe(LEADERBOARD_TEXT.hintOpen);
    expect(texts(labels.columns)).toEqual(['LV', 'SCORE', 'MASS', 'ENGULFS']);
    expect(labels.footer).toBe(leaderboardFooterText(BONUS));
  });

  it('extends the compact labels in track order, so each full label keeps its compact column', () => {
    expect(LEADERBOARD_FULL_LABELS.slice(0, LEADERBOARD_COMPACT_LABELS.length)).toEqual(LEADERBOARD_COMPACT_LABELS);
    expect(new Set(LEADERBOARD_FULL_LABELS.map((label) => label.className)).size).toBe(LEADERBOARD_FULL_LABELS.length);
  });

  it('reads CLICK TO CLOSE after the header opened the full list, since no key is held', () => {
    const labels = leaderboardLabelsFor({ isFull: true, isPinned: true, scoreAbsorptionBonus: BONUS });
    expect(labels.hint).toBe(LEADERBOARD_TEXT.hintClicked);
    expect(texts(labels.columns)).toEqual(['LV', 'SCORE', 'MASS', 'ENGULFS']);
  });

  it('drops the footer until the live balance has arrived rather than typing a bonus', () => {
    expect(leaderboardLabelsFor({ isFull: true, isPinned: false, scoreAbsorptionBonus: null }).footer).toBeNull();
  });
});

describe('leaderboardFooterText', () => {
  it('reads the bonus from the balance, formatted, in mixed case', () => {
    const bonus = formatQuantity(BONUS, QUANTITY_UNIT.count);
    expect(leaderboardFooterText(BONUS)).toBe(`Score = DNA + ${bonus} per engulf${FACT_SEPARATOR}kept on death`);
    expect(leaderboardFooterText(BONUS)).toBe('Score = DNA + 25 per engulf · kept on death');
  });

  it('follows a retuned bonus', () => {
    expect(leaderboardFooterText(BONUS + 1)).toContain(`+ ${formatQuantity(BONUS + 1, QUANTITY_UNIT.count)} per`);
  });
});
