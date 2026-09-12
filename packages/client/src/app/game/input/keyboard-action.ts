// Which action a key press or release is, given where focus sits (docs/UI.md §4). Pure: the DOM
// adapter (`keyboard-input.ts`) gathers the facts, this decides. The rules, in the order they
// are applied:
//
//  1. focus in a text field swallows every press (a release still fires, so no key sticks);
//  2. the trait keys `1` `2` `3` always act — they stay live under the menu (docs/UI.md §3.5);
//  3. Escape always acts: it is the key that closes the menu it would otherwise be swallowed by;
//  4. while the menu is open nothing else acts (sprint is swallowed, steering keeps its latch);
//  5. **Space precedence**: with focus inside `trait-offer` Space picks the focused card — the
//     card's own handler runs and the sprint path does not; anywhere else Space sprints, once
//     per press (auto-repeat is dropped);
//  6. Tab holds the full leaderboard, but only while no overlay with focusable controls is open,
//     so the picker, the menu and the results panel stay fully tab-navigable.

import type { ValueOf } from '@evolution/shared';
import {
  FULL_LEADERBOARD_KEY_CODE,
  MENU_KEY_CODE,
  SPRINT_KEY_CODE,
  STEER_DIRECTIONS,
  STEER_KEY_CODES,
  TRAIT_CARD_KEY_CODES,
  type SteerDirection,
} from './input-constants';

export const INPUT_ACTION = {
  none: 'none',
  steer: 'steer',
  sprint: 'sprint',
  pickCard: 'pick_card',
  holdFullLeaderboard: 'hold_full_leaderboard',
  releaseFullLeaderboard: 'release_full_leaderboard',
  menuKey: 'menu_key',
} as const;

export type InputActionKind = ValueOf<typeof INPUT_ACTION>;

export type InputAction =
  | { readonly kind: typeof INPUT_ACTION.none }
  | { readonly kind: typeof INPUT_ACTION.steer; readonly direction: SteerDirection; readonly isPressed: boolean }
  | { readonly kind: typeof INPUT_ACTION.sprint }
  | { readonly kind: typeof INPUT_ACTION.pickCard; readonly cardIndex: number }
  | { readonly kind: typeof INPUT_ACTION.holdFullLeaderboard }
  | { readonly kind: typeof INPUT_ACTION.releaseFullLeaderboard }
  | { readonly kind: typeof INPUT_ACTION.menuKey };

/** Where focus sits when a key arrives: the four facts docs/UI.md §4's rules read. */
export interface FocusContext {
  /** Focus is in a text field, so every press is ignored. */
  readonly isTextEntryFocused: boolean;
  /** Focus is inside the trait picker, so Space picks instead of sprinting. */
  readonly isTraitOfferFocused: boolean;
  /** The Escape menu is open (docs/UI.md §3.5). */
  readonly isMenuOpen: boolean;
  /** An overlay with focusable controls is open, so Tab must keep its native behaviour. */
  readonly hasFocusableOverlay: boolean;
}

/** A press as the rules see it; `isRepeat` is the auto-repeat a held key produces. */
export interface KeyPress {
  readonly code: string;
  readonly isRepeat: boolean;
}

export const NO_ACTION: InputAction = { kind: INPUT_ACTION.none };

/** Focus nowhere in particular: no overlay, no text field. */
export const FREE_FOCUS: FocusContext = {
  isTextEntryFocused: false,
  isTraitOfferFocused: false,
  isMenuOpen: false,
  hasFocusableOverlay: false,
};

export function steerDirectionForKeyCode(code: string): SteerDirection | null {
  return STEER_DIRECTIONS.find((direction) => STEER_KEY_CODES[direction].includes(code)) ?? null;
}

/** The trait card a `1` `2` `3` press asks for, or `null` when the code is not a card key. */
export function cardIndexForKeyCode(code: string): number | null {
  const cardIndex = TRAIT_CARD_KEY_CODES.indexOf(code);
  return cardIndex === -1 ? null : cardIndex;
}

/** Rules 2 and 3: the presses that act wherever focus sits, short of a text field. */
function alwaysLiveAction(code: string): InputAction {
  const cardIndex = cardIndexForKeyCode(code);
  if (cardIndex !== null) return { kind: INPUT_ACTION.pickCard, cardIndex };
  return code === MENU_KEY_CODE ? { kind: INPUT_ACTION.menuKey } : NO_ACTION;
}

/** Rules 5 and 6 plus steering: the presses an open menu swallows. */
function playAction(press: KeyPress, focus: FocusContext): InputAction {
  const direction = steerDirectionForKeyCode(press.code);
  if (direction !== null) return { kind: INPUT_ACTION.steer, direction, isPressed: true };
  if (press.code === SPRINT_KEY_CODE) {
    // Space precedence: inside the picker the card's own handler picks, so the sprint path stays out.
    return focus.isTraitOfferFocused || press.isRepeat ? NO_ACTION : { kind: INPUT_ACTION.sprint };
  }
  if (press.code === FULL_LEADERBOARD_KEY_CODE) {
    return focus.hasFocusableOverlay ? NO_ACTION : { kind: INPUT_ACTION.holdFullLeaderboard };
  }
  return NO_ACTION;
}

/** The action a `keydown` is. */
export function keyDownAction(press: KeyPress, focus: FocusContext): InputAction {
  if (focus.isTextEntryFocused) return NO_ACTION;
  const live = alwaysLiveAction(press.code);
  if (live.kind !== INPUT_ACTION.none) return live;
  return focus.isMenuOpen ? NO_ACTION : playAction(press, focus);
}

/**
 * The action a `keyup` is. Releases never consult focus: a key pressed over the canvas and
 * released after focus moved must still release, or the cell steers on for ever.
 */
export function keyUpAction(code: string): InputAction {
  const direction = steerDirectionForKeyCode(code);
  if (direction !== null) return { kind: INPUT_ACTION.steer, direction, isPressed: false };
  return code === FULL_LEADERBOARD_KEY_CODE ? { kind: INPUT_ACTION.releaseFullLeaderboard } : NO_ACTION;
}

/**
 * Whether the browser's default must be suppressed: the keys that would scroll the page or move
 * focus while they are steering, sprinting or holding the leaderboard open (docs/UI.md §4).
 */
export function shouldPreventDefaultFor(action: InputAction): boolean {
  return (
    action.kind === INPUT_ACTION.steer ||
    action.kind === INPUT_ACTION.sprint ||
    action.kind === INPUT_ACTION.holdFullLeaderboard
  );
}
