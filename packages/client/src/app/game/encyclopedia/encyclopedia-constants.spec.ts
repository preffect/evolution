// The words §11.7 tabulates, pinned as literals (docs/ui/encyclopedia.md §11.7).
//
// **The rule this file exists to apply is mechanical, not a judgement.** §11.7's "Value" column *is* the list: every
// row whose value is a **quoted string** is copy a doc writes out, so a spec asserts the characters; every row whose
// value is a **number** is a tunable, so a spec reads it through the constant and stays green when it is retuned. A
// guard built from the constant it tests pins the shape and never the wording — which is how four of these went
// green through a sweep that flipped all four at once (#460's review).
//
// Walk the column, not your memory of it. A row here without a test is a row whose words nothing holds.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENCYCLOPEDIA_CATEGORY,
  ENCYCLOPEDIA_BACK_KEYS,
  ENCYCLOPEDIA_NO_MATCH_PREFIX,
  ENCYCLOPEDIA_NO_MATCH_SUFFIX,
  ENCYCLOPEDIA_RESULTS_LABEL,
  ENCYCLOPEDIA_SEARCH_KEY_CODE,
  ENCYCLOPEDIA_SEARCH_PLACEHOLDER,
  ENCYCLOPEDIA_TITLE,
} from './encyclopedia-constants';

/** Every quoted-string row of §11.7 that this build declares; the lens's arrive with #373. */
const TABULATED_WORDS: readonly (readonly [name: string, value: string, written: string])[] = [
  ['ENCYCLOPEDIA_TITLE', ENCYCLOPEDIA_TITLE, 'Encyclopedia'],
  ['ENCYCLOPEDIA_SEARCH_PLACEHOLDER', ENCYCLOPEDIA_SEARCH_PLACEHOLDER, 'Search'],
  ['ENCYCLOPEDIA_RESULTS_LABEL', ENCYCLOPEDIA_RESULTS_LABEL, 'Results'],
  ['ENCYCLOPEDIA_NO_MATCH_PREFIX', ENCYCLOPEDIA_NO_MATCH_PREFIX, 'No match for "'],
  ['ENCYCLOPEDIA_NO_MATCH_SUFFIX', ENCYCLOPEDIA_NO_MATCH_SUFFIX, '"'],
  ['DEFAULT_ENCYCLOPEDIA_CATEGORY', DEFAULT_ENCYCLOPEDIA_CATEGORY, 'basics'],
  ['ENCYCLOPEDIA_SEARCH_KEY_CODE', ENCYCLOPEDIA_SEARCH_KEY_CODE, 'Slash'],
];

describe('the words docs/ui/encyclopedia.md §11.7 writes out', () => {
  it.each(TABULATED_WORDS)('%s reads exactly as the table writes it', (_name, value, written) => {
    expect(value).toBe(written);
  });

  /**
   * `ENCYCLOPEDIA_BACK_KEYS` is a quoted-string row too, but a list of chords rather than one word, so it is pinned
   * whole: both chords, in the table's order, with the modifier each one names and no other.
   */
  it('lists the Back chords exactly as the table writes them', () => {
    expect(ENCYCLOPEDIA_BACK_KEYS).toEqual([{ code: 'ArrowLeft', isAltKeyHeld: true }, { code: 'Backspace' }]);
  });

  /**
   * `ENCYCLOPEDIA_TITLE` is the weightiest of them: it is the dialog's accessible name and the landing's first crumb
   * as well as the header's word, so a screen-reader acceptance steers by it.
   */
  it('names the panel with one word in all three of its places', () => {
    expect(ENCYCLOPEDIA_TITLE).toBe('Encyclopedia');
  });
});
