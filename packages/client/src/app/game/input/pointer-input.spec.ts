import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRIMARY_POINTER_BUTTON } from './input-constants';
import { attachPointerInput, canvasPointOf } from './pointer-input';

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

function pointerEvent(type: string, detail: { clientX: number; clientY: number; button?: number }): Event {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { button: detail.button ?? PRIMARY_POINTER_BUTTON, ...detail });
  return event;
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
