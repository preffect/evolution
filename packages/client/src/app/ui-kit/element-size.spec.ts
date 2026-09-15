import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeElementSize, type ElementSize } from './element-size';

function elementWithBox(widthPx: number, heightPx: number): HTMLElement {
  const element = document.createElement('div');
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: widthPx,
    height: heightPx,
    left: 0,
    top: 0,
    right: widthPx,
    bottom: heightPx,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return element;
}

describe('observeElementSize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports the box once straight away, so a host with no observer still has a size', () => {
    const sizes: ElementSize[] = [];
    vi.stubGlobal('ResizeObserver', undefined);
    const stop = observeElementSize(elementWithBox(800, 600), (size) => sizes.push(size));
    expect(sizes).toEqual([{ widthPx: 800, heightPx: 600 }]);
    expect(() => {
      stop();
      stop();
    }).not.toThrow();
  });

  it('observes the element and reports again on a resize', () => {
    const sizes: ElementSize[] = [];
    const element = elementWithBox(800, 600);
    let notifyResize = (): void => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );

    const stop = observeElementSize(element, (size) => sizes.push(size));
    notifyResize();
    expect(sizes).toHaveLength(2);

    stop();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
