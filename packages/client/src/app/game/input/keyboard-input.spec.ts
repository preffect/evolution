import { afterEach, describe, expect, it } from 'vitest';
import { FULL_LEADERBOARD_KEY_CODE, SPRINT_KEY_CODE } from './input-constants';
import { FREE_FOCUS, INPUT_ACTION, type FocusContext, type InputAction } from './keyboard-action';
import { attachKeyboardInput, type KeyboardInputOptions } from './keyboard-input';

function attach(overrides: Partial<KeyboardInputOptions> = {}): {
  actions: InputAction[];
  releases: number;
  detach: () => void;
} {
  const actions: InputAction[] = [];
  const counters = { releases: 0 };
  const detach = attachKeyboardInput({
    ownerDocument: document,
    focusContext: (): FocusContext => FREE_FOCUS,
    isInGame: () => true,
    onAction: (action) => actions.push(action),
    onAllKeysReleased: () => {
      counters.releases += 1;
    },
    ...overrides,
  });
  return {
    actions,
    get releases(): number {
      return counters.releases;
    },
    detach,
  };
}

function press(code: string, isRepeat = false): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, repeat: isRepeat, cancelable: true, bubbles: true });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('attachKeyboardInput', () => {
  it('forwards the decided action for a press', () => {
    const attached = attach();
    document.dispatchEvent(press('KeyW'));
    expect(attached.actions).toEqual([{ kind: INPUT_ACTION.steer, direction: 'up', isPressed: true }]);
    attached.detach();
  });

  it('suppresses the browser default for a key that would scroll the page', () => {
    const attached = attach();
    const event = press(SPRINT_KEY_CODE);
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    attached.detach();
  });

  it('leaves the default alone for Tab while an overlay with focusable controls is open', () => {
    const attached = attach({ focusContext: () => ({ ...FREE_FOCUS, hasFocusableOverlay: true }) });
    const event = press(FULL_LEADERBOARD_KEY_CODE);
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    attached.detach();
  });

  it('ignores presses outside a room but still releases keys', () => {
    const attached = attach({ isInGame: () => false });
    document.dispatchEvent(press('KeyW'));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    expect(attached.actions).toEqual([{ kind: INPUT_ACTION.steer, direction: 'up', isPressed: false }]);
    attached.detach();
  });

  it('releases every key when the window loses focus', () => {
    const attached = attach();
    window.dispatchEvent(new Event('blur'));
    expect(attached.releases).toBe(1);
    attached.detach();
  });

  it('stops listening once detached', () => {
    const attached = attach();
    attached.detach();
    document.dispatchEvent(press('KeyW'));
    window.dispatchEvent(new Event('blur'));
    expect(attached.actions).toEqual([]);
    expect(attached.releases).toBe(0);
  });
});
