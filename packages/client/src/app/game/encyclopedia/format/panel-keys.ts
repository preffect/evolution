// The encyclopedia's own keyboard model, pure (docs/ui/encyclopedia.md §11.5): which of the panel's four key actions
// a press is, given where focus sits. The panel gathers the facts from the DOM and runs the answer; nothing here
// touches Angular, the DOM or a render concern, so every rule is unit-testable without a browser.
//
// Escape is **not** among these. It has one owner per press (input-and-onboarding.md §4): the kit search field
// consumes it while a query is up, and an unconsumed one closes the panel — in a room through the HUD's topmost
// order, in the lobby through the host's own listener. Neither path passes through this file.
//
// The roving arrows (↑ ↓ Home End) are not here either: they are the kit group's, which is why a vertical group
// leaves ← → alone — so that the panel can spend them moving between the two columns.

import type { ValueOf } from '@evolution/shared';
import {
  ENCYCLOPEDIA_BACK_KEYS,
  ENCYCLOPEDIA_SEARCH_KEY_CODE,
  type EncyclopediaKeyChord,
} from '../encyclopedia-constants';

/** The two roving columns, as the panel's ← → rule names them. */
export const ENCYCLOPEDIA_COLUMN = { rail: 'rail', list: 'list' } as const;
export type EncyclopediaColumn = ValueOf<typeof ENCYCLOPEDIA_COLUMN>;

export const ENCYCLOPEDIA_KEY_ACTION = {
  /** The panel leaves the press alone: the kit groups, the search field and Escape's owner all live outside it. */
  none: 'none',
  focusSearch: 'focus_search',
  /** Enter in the search field (§11.5): the strongest match, which is the row the list draws first. */
  openFirstResult: 'open_first_result',
  goBack: 'go_back',
  focusRail: 'focus_rail',
  focusList: 'focus_list',
} as const;
export type EncyclopediaKeyAction = ValueOf<typeof ENCYCLOPEDIA_KEY_ACTION>;

/** A press as the rules see it. */
export interface EncyclopediaKeyPress {
  readonly code: string;
  readonly isAltKeyHeld: boolean;
  /**
   * Focus is in a text field, which keeps `/` as a character and Backspace as the delete key (§11.5). Inside the
   * panel the only text field is the search field, so that is what the panel answers this with.
   */
  readonly isTextEntryFocused: boolean;
  /** Which roving column holds focus, or `null` for the header and the detail column. */
  readonly focusedColumn: EncyclopediaColumn | null;
}

/** The keys that cross between the columns: a vertical kit group leaves them alone, exactly so a feature can (§10.2). */
const COLUMN_FORWARD_KEY_CODE = 'ArrowRight';
const COLUMN_BACKWARD_KEY_CODE = 'ArrowLeft';

/** Enter, which in the search field opens the first result (§11.5) and anywhere else is its own control's. */
const SEARCH_SUBMIT_KEY_CODE = 'Enter';

/**
 * A chord matches a press on its code and on every modifier it names; a modifier it does not name must be **up**.
 * So `Alt+←` is Back and a bare `←` is the column move, and `Alt+Backspace` is neither rather than both.
 */
function matchesChord(press: EncyclopediaKeyPress, chord: EncyclopediaKeyChord): boolean {
  return press.code === chord.code && press.isAltKeyHeld === (chord.isAltKeyHeld ?? false);
}

/**
 * Which Back chords a text field swallows, derived from the chord rather than named key by key: an **unmodified**
 * key is one the field is using — Backspace deletes, and any future bare chord would type — while a modified one is
 * not. That is §11.7's "Backspace only outside a text field", written so that adding a chord cannot forget it.
 */
function isSwallowedByTextEntry(chord: EncyclopediaKeyChord): boolean {
  return chord.isAltKeyHeld !== true;
}

/** Back (§11.5): `Alt+←` anywhere in the panel, Backspace only where it is not the delete key. */
function isBackPress(press: EncyclopediaKeyPress): boolean {
  return ENCYCLOPEDIA_BACK_KEYS.some(
    (chord) => matchesChord(press, chord) && !(press.isTextEntryFocused && isSwallowedByTextEntry(chord)),
  );
}

/**
 * ← → move between the rail and the list (§11.5). Only outward: → from the rail reaches the list and ← from the
 * list reaches the rail, while the other two would leave the columns altogether and do nothing.
 */
function columnMoveFor(press: EncyclopediaKeyPress): EncyclopediaKeyAction {
  if (press.focusedColumn === ENCYCLOPEDIA_COLUMN.rail && press.code === COLUMN_FORWARD_KEY_CODE) {
    return ENCYCLOPEDIA_KEY_ACTION.focusList;
  }
  if (press.focusedColumn === ENCYCLOPEDIA_COLUMN.list && press.code === COLUMN_BACKWARD_KEY_CODE) {
    return ENCYCLOPEDIA_KEY_ACTION.focusRail;
  }
  return ENCYCLOPEDIA_KEY_ACTION.none;
}

/**
 * The action a `keydown` inside the panel is, in this order: Back first, so `Alt+←` is Back rather than a move out
 * of the list; then Enter, which belongs to the field it was typed in; then `/`; then the column move.
 *
 * Everything after Back is gated on the text field, each for its own reason — `/` is a character there, Enter is the
 * field's, and ← → move the caret — so the last two arms read the same flag rather than sharing one early return.
 */
export function encyclopediaKeyAction(press: EncyclopediaKeyPress): EncyclopediaKeyAction {
  if (isBackPress(press)) return ENCYCLOPEDIA_KEY_ACTION.goBack;
  if (press.code === SEARCH_SUBMIT_KEY_CODE) {
    return press.isTextEntryFocused ? ENCYCLOPEDIA_KEY_ACTION.openFirstResult : ENCYCLOPEDIA_KEY_ACTION.none;
  }
  if (press.code === ENCYCLOPEDIA_SEARCH_KEY_CODE) {
    return press.isTextEntryFocused ? ENCYCLOPEDIA_KEY_ACTION.none : ENCYCLOPEDIA_KEY_ACTION.focusSearch;
  }
  return press.isTextEntryFocused ? ENCYCLOPEDIA_KEY_ACTION.none : columnMoveFor(press);
}
