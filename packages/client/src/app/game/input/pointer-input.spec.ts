import { ManualClock } from '@evolution/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakePointerLock } from '../../../testing/fake-pointer-lock';
import { MOUSE_POINTER_TYPE, PRIMARY_POINTER_BUTTON } from './input-constants';
import { attachPointerInput, canvasPointOf } from './pointer-input';
import { PointerLockInput } from './pointer-lock-input';

const HOST_BOX = { left: 40, top: 20, width: 800, height: 600 };

function createHost(): HTMLElement {
  const host = document.createElement('div');
  host.tabIndex = 0;
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    ...HOST_BOX,
    right: HOST_BOX.left + HOST_BOX.width,
    bottom: HOST_BOX.top + HOST_BOX.height,
    x: HOST_BOX.left,
    y: HOST_BOX.top,
    toJSON: () => ({}),
  });
  document.body.append(host);
  return host;
}

interface PointerDetail {
  clientX: number;
  clientY: number;
  button?: number;
  pointerType?: string;
  movementX?: number;
  movementY?: number;
}

function pointerEvent(type: string, detail: PointerDetail): Event {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { button: detail.button ?? PRIMARY_POINTER_BUTTON, ...detail });
  return event;
}

/** A host with the fake Pointer Lock API and a lock whose toggle is on. */
function createLockedSetup(): {
  host: HTMLElement;
  browser: ReturnType<typeof installFakePointerLock>;
  onSprint: ReturnType<typeof vi.fn>;
  onPointerMoved: ReturnType<typeof vi.fn>;
} {
  const host = createHost();
  const browser = installFakePointerLock(host);
  const pointerLock = new PointerLockInput({
    host,
    clock: new ManualClock(0),
    seam: { isEnabled: () => true, isCursorNeeded: () => false, onUserExit: vi.fn(), onCursorMoved: vi.fn() },
  });
  const onSprint = vi.fn();
  const onPointerMoved = vi.fn();
  attachPointerInput({ host, onPointerMoved, onSprint, pointerLock });
  return { host, browser, onSprint, onPointerMoved };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('canvasPointOf', () => {
  it('reports the pointer in the host box own pixels', () => {
    const host = createHost();
    expect(canvasPointOf(host, { clientX: 140, clientY: 320 })).toEqual({ x: 100, y: 300 });
  });
});

describe('attachPointerInput', () => {
  it('reports every move as a canvas point', () => {
    const host = createHost();
    const onPointerMoved = vi.fn();
    attachPointerInput({ host, onPointerMoved, onSprint: vi.fn() });
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 320 }));
    expect(onPointerMoved).toHaveBeenCalledWith({ x: 100, y: 300 });
  });

  it('sprints on a left click and takes focus for the hotkeys', () => {
    const host = createHost();
    const onSprint = vi.fn();
    attachPointerInput({ host, onPointerMoved: vi.fn(), onSprint });
    host.dispatchEvent(pointerEvent('pointerdown', { clientX: 140, clientY: 320 }));
    expect(onSprint).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(host);
  });

  it('does not sprint on a secondary button', () => {
    const host = createHost();
    const onSprint = vi.fn();
    attachPointerInput({ host, onPointerMoved: vi.fn(), onSprint });
    host.dispatchEvent(pointerEvent('pointerdown', { clientX: 140, clientY: 320, button: 2 }));
    expect(onSprint).not.toHaveBeenCalled();
  });

  it('stops listening once detached', () => {
    const host = createHost();
    const onPointerMoved = vi.fn();
    const detach = attachPointerInput({ host, onPointerMoved, onSprint: vi.fn() });
    detach();
    host.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 320 }));
    expect(onPointerMoved).not.toHaveBeenCalled();
  });
});

describe('attachPointerInput with the mouse lock', () => {
  const mouseClick = { clientX: 140, clientY: 320, pointerType: MOUSE_POINTER_TYPE };

  it('locks on the first mouse click without sprinting, then sprints on the next', () => {
    const { host, browser, onSprint } = createLockedSetup();
    host.dispatchEvent(pointerEvent('pointerdown', mouseClick));
    expect(browser.requests).toHaveBeenCalledOnce();
    expect(onSprint).not.toHaveBeenCalled();

    browser.grant();
    host.dispatchEvent(pointerEvent('pointerdown', mouseClick));
    expect(onSprint).toHaveBeenCalledOnce();
    browser.restore();
  });

  it('steers from the virtual pointer while locked: movement moves it, the frozen client position does not', () => {
    const { host, browser, onPointerMoved } = createLockedSetup();
    host.dispatchEvent(pointerEvent('pointerdown', mouseClick));
    browser.grant();
    host.dispatchEvent(pointerEvent('pointermove', { ...mouseClick, movementX: 12, movementY: -4 }));
    expect(onPointerMoved).toHaveBeenLastCalledWith({ x: 112, y: 296 });
    host.dispatchEvent(pointerEvent('pointerdown', mouseClick));
    expect(onPointerMoved).toHaveBeenLastCalledWith({ x: 112, y: 296 });
    browser.restore();
  });

  it('never locks a touch: a tap sprints as it always did', () => {
    const { host, browser, onSprint } = createLockedSetup();
    host.dispatchEvent(pointerEvent('pointerdown', { ...mouseClick, pointerType: 'touch' }));
    expect(browser.requests).not.toHaveBeenCalled();
    expect(onSprint).toHaveBeenCalledOnce();
    browser.restore();
  });
});
