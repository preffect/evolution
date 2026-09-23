// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LEADERBOARD_NAME_MAX_CHARS } from '../hud-constants';
import { truncatePlayerName } from './player-name';

describe('truncatePlayerName', () => {
  it('leaves a name that fits alone', () => {
    expect(truncatePlayerName('Amoeba')).toBe('Amoeba');
    expect(truncatePlayerName('x'.repeat(LEADERBOARD_NAME_MAX_CHARS))).toHaveLength(LEADERBOARD_NAME_MAX_CHARS);
  });

  it('ellipsises a longer one to exactly the column width', () => {
    const truncated = truncatePlayerName('x'.repeat(LEADERBOARD_NAME_MAX_CHARS + 20));
    expect(truncated).toHaveLength(LEADERBOARD_NAME_MAX_CHARS);
    expect(truncated.endsWith('…')).toBe(true);
  });

  it('cuts in code points, so a name whose glyph straddles the cut does not lose half a pair', () => {
    // Eleven ASCII characters then an astral glyph: a UTF-16 slice at 11 would keep its high
    // surrogate alone and render a replacement box.
    const name = `${'x'.repeat(LEADERBOARD_NAME_MAX_CHARS - 1)}🧬🧬`;
    const truncated = truncatePlayerName(name);
    expect([...truncated]).toHaveLength(LEADERBOARD_NAME_MAX_CHARS);
    expect(truncated).toBe(`${'x'.repeat(LEADERBOARD_NAME_MAX_CHARS - 1)}…`);
    expect(truncated).not.toMatch(/[\uD800-\uDFFF]/);
  });

  it('counts an all-astral name by its glyphs rather than by its UTF-16 length', () => {
    // Twelve glyphs is 24 UTF-16 units; counting those would ellipsise a name that fits.
    expect(truncatePlayerName('🧬'.repeat(LEADERBOARD_NAME_MAX_CHARS))).toBe('🧬'.repeat(LEADERBOARD_NAME_MAX_CHARS));
  });
});
