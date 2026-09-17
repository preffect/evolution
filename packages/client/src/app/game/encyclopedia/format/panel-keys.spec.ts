// The panel's key rules (docs/testing/tiers-and-builders.md §2.1, docs/ui/encyclopedia.md §11.5). Pure, so every case
// is a record in and a string out — no DOM, no fixture, no component.

import { describe, expect, it } from 'vitest';
import { ENCYCLOPEDIA_BACK_KEYS, ENCYCLOPEDIA_SEARCH_KEY_CODE } from '../encyclopedia-constants';
import {
  ENCYCLOPEDIA_COLUMN,
  ENCYCLOPEDIA_KEY_ACTION,
  encyclopediaKeyAction,
  type EncyclopediaKeyPress,
} from './panel-keys';

/** A press with nothing special about it: outside a text field, outside both columns, no modifier held. */
function press(overrides: Partial<EncyclopediaKeyPress> = {}): EncyclopediaKeyPress {
  return { code: 'KeyZ', isAltKeyHeld: false, isTextEntryFocused: false, focusedColumn: null, ...overrides };
}

const [ALT_LEFT_CHORD, BACKSPACE_CHORD] = ENCYCLOPEDIA_BACK_KEYS;

describe('encyclopediaKeyAction (docs/ui/encyclopedia.md §11.5)', () => {
  it('leaves a key it has no rule for alone, so the kit groups and Escape keep their own', () => {
    expect(encyclopediaKeyAction(press({ code: 'Escape' }))).toBe(ENCYCLOPEDIA_KEY_ACTION.none);
    expect(encyclopediaKeyAction(press({ code: 'ArrowDown', focusedColumn: ENCYCLOPEDIA_COLUMN.list }))).toBe(
      ENCYCLOPEDIA_KEY_ACTION.none,
    );
  });

  describe('the search key', () => {
    it('focuses the field from anywhere in the panel', () => {
      expect(encyclopediaKeyAction(press({ code: ENCYCLOPEDIA_SEARCH_KEY_CODE }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.focusSearch,
      );
      expect(
        encyclopediaKeyAction(press({ code: ENCYCLOPEDIA_SEARCH_KEY_CODE, focusedColumn: ENCYCLOPEDIA_COLUMN.rail })),
      ).toBe(ENCYCLOPEDIA_KEY_ACTION.focusSearch);
    });

    it('is a character in a text field, where the reader is already typing', () => {
      expect(encyclopediaKeyAction(press({ code: ENCYCLOPEDIA_SEARCH_KEY_CODE, isTextEntryFocused: true }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.none,
      );
    });
  });

  describe('the Back keys (§11.7)', () => {
    it('goes back on every chord the table lists', () => {
      for (const chord of ENCYCLOPEDIA_BACK_KEYS) {
        expect(encyclopediaKeyAction(press({ code: chord.code, isAltKeyHeld: chord.isAltKeyHeld ?? false }))).toBe(
          ENCYCLOPEDIA_KEY_ACTION.goBack,
        );
      }
    });

    it('keeps Backspace as the delete key in a text field, while the modified chord still goes back', () => {
      expect(encyclopediaKeyAction(press({ code: BACKSPACE_CHORD!.code, isTextEntryFocused: true }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.none,
      );
      expect(
        encyclopediaKeyAction(press({ code: ALT_LEFT_CHORD!.code, isAltKeyHeld: true, isTextEntryFocused: true })),
      ).toBe(ENCYCLOPEDIA_KEY_ACTION.goBack);
    });

    it('wants the modifier exactly as the chord writes it: a bare ← is not Back', () => {
      expect(encyclopediaKeyAction(press({ code: ALT_LEFT_CHORD!.code, isAltKeyHeld: false }))).not.toBe(
        ENCYCLOPEDIA_KEY_ACTION.goBack,
      );
      expect(encyclopediaKeyAction(press({ code: BACKSPACE_CHORD!.code, isAltKeyHeld: true }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.none,
      );
    });

    /** The one place the two rules overlap: ← is both the column move and half of `Alt+←`, and Back wins. */
    it('reads Alt+← as Back rather than as the move out of the list', () => {
      expect(
        encyclopediaKeyAction(
          press({ code: ALT_LEFT_CHORD!.code, isAltKeyHeld: true, focusedColumn: ENCYCLOPEDIA_COLUMN.list }),
        ),
      ).toBe(ENCYCLOPEDIA_KEY_ACTION.goBack);
    });
  });

  describe('← → between the two columns', () => {
    it('crosses outward from each column', () => {
      expect(encyclopediaKeyAction(press({ code: 'ArrowRight', focusedColumn: ENCYCLOPEDIA_COLUMN.rail }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.focusList,
      );
      expect(encyclopediaKeyAction(press({ code: 'ArrowLeft', focusedColumn: ENCYCLOPEDIA_COLUMN.list }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.focusRail,
      );
    });

    it('does nothing where the move would leave the columns altogether', () => {
      expect(encyclopediaKeyAction(press({ code: 'ArrowLeft', focusedColumn: ENCYCLOPEDIA_COLUMN.rail }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.none,
      );
      expect(encyclopediaKeyAction(press({ code: 'ArrowRight', focusedColumn: ENCYCLOPEDIA_COLUMN.list }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.none,
      );
      expect(encyclopediaKeyAction(press({ code: 'ArrowRight', focusedColumn: null }))).toBe(
        ENCYCLOPEDIA_KEY_ACTION.none,
      );
    });

    it('moves the caret rather than the column while a text field holds focus', () => {
      expect(
        encyclopediaKeyAction(
          press({ code: 'ArrowRight', focusedColumn: ENCYCLOPEDIA_COLUMN.rail, isTextEntryFocused: true }),
        ),
      ).toBe(ENCYCLOPEDIA_KEY_ACTION.none);
    });
  });
});
