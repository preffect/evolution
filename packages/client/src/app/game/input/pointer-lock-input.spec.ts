import { ManualClock } from '@evolution/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePointerLock, type FakePointerLock } from '../../../testing/fake-pointer-lock';
import {
  POINTER_LOCK_MAX_FAILED_REQUESTS,
  POINTER_LOCK_RETRY_COOLDOWN_MS,
  POINTER_LOCK_UNSUPPORTED_OPTION_ERROR,
} from './input-constants';
import { PointerLockInput, type PointerLockSeam } from './pointer-lock-input';

const HOST_BOX = { left: 0, top: 0, width: 800, height: 600 };
const CLICK_POINT = { x: 400, y: 300 };

function createHost(): HTMLElement {
  const host = document.createElement('div');
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    ...HOST_BOX,
    right: HOST_BOX.width,
    bottom: HOST_BOX.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  document.body.append(host);
  return host;
}

describe('PointerLockInput', () => {
  let host: HTMLElement;
  let browser: FakePointerLock;
  let clock: ManualClock;
  let seam: { [K in keyof PointerLockSeam]: ReturnType<typeof vi.fn> };
  let isEnabled: boolean;
  let isCursorNeeded: boolean;
  let lock: PointerLockInput;

  beforeEach(() => {
    host = createHost();
    browser = installFakePointerLock(host);
    clock = new ManualClock(0);
    isEnabled = true;
    isCursorNeeded = false;
    seam = {
      isEnabled: vi.fn(() => isEnabled),
      isCursorNeeded: vi.fn(() => isCursorNeeded),
      onUserExit: vi.fn(),
      onCursorMoved: vi.fn(),
    };
    lock = new PointerLockInput({ host, clock, seam: seam as unknown as PointerLockSeam });
  });

  afterEach(() => {
    lock.detach();
    browser.restore();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function lockAt(point = CLICK_POINT): void {
    expect(lock.pressWhileUnlocked(point)).toBe(false);
    browser.grant();
  }

  it('asks for raw movement on the locking click, which does not sprint, and draws the cursor where it was made', () => {
    lockAt();
    expect(browser.requests).toHaveBeenCalledWith({ unadjustedMovement: true });
    expect(lock.isLocked()).toBe(true);
    expect(seam.onCursorMoved).toHaveBeenLastCalledWith(CLICK_POINT);
  });

  it('asks again without raw movement where the platform refuses that option, and ends locked with no failure', async () => {
    // Chrome's order: the option's rejection (a microtask), the plain retry while still requesting, then the
    // refusal's `pointerlockerror` (a task), then the retry's grant.
    lock.pressWhileUnlocked(CLICK_POINT);
    await browser.refuse(POINTER_LOCK_UNSUPPORTED_OPTION_ERROR);
    expect(browser.requests).toHaveBeenCalledTimes(2);
    expect(browser.requests).toHaveBeenLastCalledWith();
    browser.grant();
    expect(lock.isLocked()).toBe(true);

    // The grant cleared the count: three later refusals in a row are needed to give up, not two.
    browser.unlock({ hasDocumentFocus: false });
    for (let attempt = 1; attempt < POINTER_LOCK_MAX_FAILED_REQUESTS; attempt += 1) {
      clock.advanceMilliseconds(POINTER_LOCK_RETRY_COOLDOWN_MS);
      lock.pressWhileUnlocked(CLICK_POINT);
      await browser.refuse();
    }
    clock.advanceMilliseconds(POINTER_LOCK_RETRY_COOLDOWN_MS);
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(false);
  });

  it('does not retry a refusal that is not about the raw-movement option', async () => {
    lock.pressWhileUnlocked(CLICK_POINT);
    await browser.refuse();
    expect(browser.requests).toHaveBeenCalledOnce();
    expect(lock.isLocked()).toBe(false);
  });

  it('moves the virtual pointer by the movement, clamped to the canvas, and tells the HUD', () => {
    lockAt();
    expect(lock.movedBy({ movementX: 25, movementY: -10 })).toEqual({ x: 425, y: 290 });
    expect(lock.movedBy({ movementX: 9000, movementY: 9000 })).toEqual({ x: HOST_BOX.width, y: HOST_BOX.height });
    expect(seam.onCursorMoved).toHaveBeenLastCalledWith({ x: HOST_BOX.width, y: HOST_BOX.height });
  });

  it('treats an Escape exit as Escape: the menu opens, the cursor goes and a re-lock waits out the cooldown', () => {
    lockAt();
    browser.unlock({ hasDocumentFocus: true });
    expect(seam.onUserExit).toHaveBeenCalledOnce();
    expect(seam.onCursorMoved).toHaveBeenLastCalledWith(null);

    clock.advanceMilliseconds(POINTER_LOCK_RETRY_COOLDOWN_MS - 1);
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(false);
    expect(browser.requests).toHaveBeenCalledOnce();
    clock.advanceMilliseconds(1);
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(false);
    expect(browser.requests).toHaveBeenCalledTimes(2);
  });

  it('opens no menu when the lock is lost to a focus loss, and re-locks on the next click', () => {
    lockAt();
    browser.unlock({ hasDocumentFocus: false });
    expect(seam.onUserExit).not.toHaveBeenCalled();
    expect(lock.isLocked()).toBe(false);
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(false);
    expect(browser.requests).toHaveBeenCalledTimes(2);
  });

  it('hands the lock back once for an overlay that needs the cursor, which is no Escape', () => {
    lockAt();
    isCursorNeeded = true;
    lock.syncWithHud();
    lock.syncWithHud();
    expect(browser.exits).toHaveBeenCalledOnce();
    browser.settle();
    expect(seam.onUserExit).not.toHaveBeenCalled();
    expect(lock.isLocked()).toBe(false);
  });

  it('keeps the lock with no overlay up (the trait picker is not one)', () => {
    lockAt();
    lock.syncWithHud();
    expect(browser.exits).not.toHaveBeenCalled();
  });

  it('sprints on a click while the toggle is off, and never asks', () => {
    isEnabled = false;
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(true);
    expect(browser.requests).not.toHaveBeenCalled();
  });

  it('counts a refusal, ignores clicks through the cooldown, and gives up for good at the cap', async () => {
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(false);
    await browser.refuse();
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(false);
    expect(browser.requests).toHaveBeenCalledOnce();
    for (let attempt = 1; attempt < POINTER_LOCK_MAX_FAILED_REQUESTS; attempt += 1) {
      clock.advanceMilliseconds(POINTER_LOCK_RETRY_COOLDOWN_MS);
      expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(false);
      await browser.refuse();
    }
    clock.advanceMilliseconds(POINTER_LOCK_RETRY_COOLDOWN_MS);
    expect(browser.requests).toHaveBeenCalledTimes(POINTER_LOCK_MAX_FAILED_REQUESTS);
    expect(lock.pressWhileUnlocked(CLICK_POINT)).toBe(true);
  });

  it('clicks the HUD control under the locked pointer instead of sprinting, and hovers it', () => {
    const card = document.body.appendChild(document.createElement('button'));
    const onClick = vi.fn();
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    card.addEventListener('click', onClick);
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);
    lockAt();
    expect(lock.pressWhileLocked()).toBe(true);

    browser.setElementAtPoint(card);
    lock.movedBy({ movementX: 1, movementY: 0 });
    expect(onEnter).toHaveBeenCalledOnce();
    expect(lock.pressWhileLocked()).toBe(false);
    expect(onClick).toHaveBeenCalledOnce();

    // The lock goes with the card hovered: it is left, so no highlight or trait preview outlives the virtual pointer.
    expect(onLeave).not.toHaveBeenCalled();
    browser.unlock({ hasDocumentFocus: true });
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('clicks the card around an SVG glyph under the locked pointer, rather than sprinting', () => {
    const card = document.body.appendChild(document.createElement('button'));
    const glyph = card.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    const shape = glyph.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
    const onClick = vi.fn();
    card.addEventListener('click', onClick);
    lockAt();
    browser.setElementAtPoint(shape);
    expect(lock.pressWhileLocked()).toBe(false);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("lets go on detach without calling it an Escape, and hears nothing of a later room's lock", () => {
    lockAt();
    lock.detach();
    expect(browser.exits).toHaveBeenCalledOnce();
    browser.settle();
    expect(seam.onUserExit).not.toHaveBeenCalled();
    expect(seam.onCursorMoved).toHaveBeenLastCalledWith(null);

    const cursorCalls = seam.onCursorMoved.mock.calls.length;
    browser.grant();
    browser.unlock({ hasDocumentFocus: true });
    expect(seam.onUserExit).not.toHaveBeenCalled();
    expect(seam.onCursorMoved).toHaveBeenCalledTimes(cursorCalls);
    expect(browser.exits).toHaveBeenCalledOnce();
  });

  it('releases a grant that arrives after the room went, and then stops listening', () => {
    lock.pressWhileUnlocked(CLICK_POINT);
    lock.detach();
    const cursorCalls = seam.onCursorMoved.mock.calls.length;
    browser.grant();
    expect(browser.exits).toHaveBeenCalledOnce();
    browser.settle();
    browser.grant();
    browser.unlock({ hasDocumentFocus: true });
    expect(browser.exits).toHaveBeenCalledOnce();
    expect(seam.onUserExit).not.toHaveBeenCalled();
    expect(seam.onCursorMoved).toHaveBeenCalledTimes(cursorCalls);
  });
});
