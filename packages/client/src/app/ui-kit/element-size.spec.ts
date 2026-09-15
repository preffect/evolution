import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElementSizeTracker, NO_ELEMENT_SIZE, observeElementSize, type ElementSize } from './element-size';

/** A `ResizeObserver` whose `observe` and `disconnect` can be counted. */
function stubResizeObserver(): { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } {
  const spies = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = spies.observe;
      disconnect = spies.disconnect;
    },
  );
  return spies;
}

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

describe('ElementSizeTracker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function trackerFor(element: Element): ElementSizeTracker {
    return TestBed.runInInjectionContext(() => new ElementSizeTracker(element));
  }

  it('holds no box until it starts, so a host reads its size once its layout exists', () => {
    const tracker = trackerFor(elementWithBox(1280, 800));
    expect(tracker.size()).toEqual(NO_ELEMENT_SIZE);
    tracker.start();
    expect(tracker.size()).toEqual({ widthPx: 1280, heightPx: 800 });
  });

  it('starts observing once, however often start is called', () => {
    const spies = stubResizeObserver();
    const tracker = trackerFor(elementWithBox(800, 600));
    tracker.start();
    tracker.start();
    expect(spies.observe).toHaveBeenCalledOnce();
  });

  it('stops observing when the context that made it is destroyed, with no teardown of its own', () => {
    const spies = stubResizeObserver();
    trackerFor(elementWithBox(800, 600)).start();
    expect(spies.disconnect).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    expect(spies.disconnect).toHaveBeenCalledOnce();
  });
});
