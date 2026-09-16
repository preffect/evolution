import { describe, expect, it } from 'vitest';
import { TRAIT_DRAFT_SIZE } from '@evolution/shared';
import {
  FULL_LEADERBOARD_KEY_CODE,
  MENU_KEY_CODE,
  SPRINT_KEY_CODE,
  STEER_DIRECTIONS,
  STEER_KEY_CODES,
  TRAIT_CARD_KEY_CODES,
} from './input-constants';
import {
  FREE_FOCUS,
  INPUT_ACTION,
  cardIndexForKeyCode,
  keyDownAction,
  keyUpAction,
  shouldPreventDefaultFor,
  steerDirectionForKeyCode,
  type FocusContext,
  type KeyPress,
} from './keyboard-action';

function focus(overrides: Partial<FocusContext> = {}): FocusContext {
  return { ...FREE_FOCUS, ...overrides };
}

function press(code: string, isRepeat = false): KeyPress {
  return { code, isRepeat, isDefaultPrevented: false };
}

/** A press a component on the way up already consumed with `preventDefault()`. */
function consumed(code: string): KeyPress {
  return { code, isRepeat: false, isDefaultPrevented: true };
}

describe('the key tables', () => {
  it('offers one card key per drafted card', () => {
    expect(TRAIT_CARD_KEY_CODES).toEqual(['Digit1', 'Digit2', 'Digit3']);
    expect(TRAIT_CARD_KEY_CODES).toHaveLength(TRAIT_DRAFT_SIZE);
  });

  it('maps every WASD and arrow code to its direction', () => {
    for (const direction of STEER_DIRECTIONS) {
      for (const code of STEER_KEY_CODES[direction]) {
        expect(steerDirectionForKeyCode(code)).toBe(direction);
      }
    }
  });

  it('answers null for a code that does not steer', () => {
    expect(steerDirectionForKeyCode('KeyQ')).toBeNull();
    expect(cardIndexForKeyCode('KeyQ')).toBeNull();
  });
});

describe('keyDownAction', () => {
  it('steers on W', () => {
    expect(keyDownAction(press('KeyW'), focus())).toEqual({
      kind: INPUT_ACTION.steer,
      direction: 'up',
      isPressed: true,
    });
  });

  it('sprints on Space with focus outside the trait picker', () => {
    expect(keyDownAction(press(SPRINT_KEY_CODE), focus())).toEqual({ kind: INPUT_ACTION.sprint });
  });

  it('does not sprint on Space with focus inside the trait picker', () => {
    const action = keyDownAction(
      press(SPRINT_KEY_CODE),
      focus({ isTraitOfferFocused: true, hasFocusableOverlay: true }),
    );
    expect(action).toEqual({ kind: INPUT_ACTION.none });
  });

  it('sprints once per press: auto-repeat is dropped', () => {
    expect(keyDownAction(press(SPRINT_KEY_CODE, true), focus())).toEqual({ kind: INPUT_ACTION.none });
  });

  it('picks the card a digit names', () => {
    expect(keyDownAction(press('Digit2'), focus())).toEqual({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
  });

  it('keeps the trait keys live while the menu is open', () => {
    expect(keyDownAction(press('Digit3'), focus({ isModalOverlayOpen: true }))).toEqual({
      kind: INPUT_ACTION.pickCard,
      cardIndex: 2,
    });
  });

  it('swallows sprint while the menu is open', () => {
    const action = keyDownAction(press(SPRINT_KEY_CODE), focus({ isModalOverlayOpen: true }));
    expect(action).toEqual({ kind: INPUT_ACTION.none });
  });

  it('swallows steering and the arrows while the menu is open, leaving the arrows to its list', () => {
    expect(keyDownAction(press('KeyD'), focus({ isModalOverlayOpen: true }))).toEqual({ kind: INPUT_ACTION.none });
    expect(keyDownAction(press('ArrowDown'), focus({ isModalOverlayOpen: true }))).toEqual({
      kind: INPUT_ACTION.none,
    });
  });

  it('keeps Escape live while the menu is open, since Escape is what closes it', () => {
    const action = keyDownAction(press(MENU_KEY_CODE), focus({ isModalOverlayOpen: true }));
    expect(action).toEqual({ kind: INPUT_ACTION.menuKey });
  });

  it('does nothing for an Escape a component consumed', () => {
    expect(keyDownAction(consumed(MENU_KEY_CODE), focus())).toEqual({ kind: INPUT_ACTION.none });
  });

  it('leaves the menu open when the exit confirm consumed the Escape that restored its row', () => {
    const action = keyDownAction(
      consumed(MENU_KEY_CODE),
      focus({ isModalOverlayOpen: true, hasFocusableOverlay: true }),
    );
    expect(action).toEqual({ kind: INPUT_ACTION.none });
  });

  it('acts on an unconsumed Escape even from a text field, so a field never traps the player', () => {
    const action = keyDownAction(press(MENU_KEY_CODE), focus({ isTextEntryFocused: true }));
    expect(action).toEqual({ kind: INPUT_ACTION.menuKey });
  });

  it('ignores every other press while focus is in a text field', () => {
    const textEntry = focus({ isTextEntryFocused: true });
    expect(keyDownAction(press('KeyW'), textEntry)).toEqual({ kind: INPUT_ACTION.none });
    expect(keyDownAction(press('Digit1'), textEntry)).toEqual({ kind: INPUT_ACTION.none });
    expect(keyDownAction(press(SPRINT_KEY_CODE), textEntry)).toEqual({ kind: INPUT_ACTION.none });
  });

  it('holds the full leaderboard on Tab with no overlay open', () => {
    expect(keyDownAction(press(FULL_LEADERBOARD_KEY_CODE), focus())).toEqual({
      kind: INPUT_ACTION.holdFullLeaderboard,
    });
  });

  it('leaves Tab native while an overlay with focusable controls is open', () => {
    const action = keyDownAction(press(FULL_LEADERBOARD_KEY_CODE), focus({ hasFocusableOverlay: true }));
    expect(action).toEqual({ kind: INPUT_ACTION.none });
  });
});

describe('keyUpAction', () => {
  it('releases a steer key wherever focus went', () => {
    expect(keyUpAction('ArrowLeft')).toEqual({ kind: INPUT_ACTION.steer, direction: 'left', isPressed: false });
  });

  it('releases the full leaderboard on Tab up', () => {
    expect(keyUpAction(FULL_LEADERBOARD_KEY_CODE)).toEqual({ kind: INPUT_ACTION.releaseFullLeaderboard });
  });

  it('is nothing for a key with no release meaning', () => {
    expect(keyUpAction(SPRINT_KEY_CODE)).toEqual({ kind: INPUT_ACTION.none });
  });
});

describe('shouldPreventDefaultFor', () => {
  it('suppresses the default for the keys that would scroll or move focus', () => {
    expect(shouldPreventDefaultFor({ kind: INPUT_ACTION.sprint })).toBe(true);
    expect(shouldPreventDefaultFor({ kind: INPUT_ACTION.steer, direction: 'up', isPressed: true })).toBe(true);
    expect(shouldPreventDefaultFor({ kind: INPUT_ACTION.holdFullLeaderboard })).toBe(true);
  });

  it('leaves the default alone for the keys that do not', () => {
    expect(shouldPreventDefaultFor({ kind: INPUT_ACTION.none })).toBe(false);
    expect(shouldPreventDefaultFor({ kind: INPUT_ACTION.menuKey })).toBe(false);
    expect(shouldPreventDefaultFor({ kind: INPUT_ACTION.pickCard, cardIndex: 0 })).toBe(false);
  });
});
