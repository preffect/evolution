import { DestroyRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { REDUCED_MOTION_QUERY, reducedMotionPreference } from './reduced-motion';

/** A destroy ref whose callbacks the spec runs by hand. */
function manualDestroyReference(): { readonly ref: DestroyRef; readonly destroy: () => void } {
  const callbacks: (() => void)[] = [];
  const ref = { onDestroy: (callback: () => void) => callbacks.push(callback) } as unknown as DestroyRef;
  return { ref, destroy: () => callbacks.forEach((callback) => callback()) };
}

/** A `matchMedia` host with one query whose `matches` the spec flips. */
function mediaHost(isInitiallyMatching: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: isInitiallyMatching,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  };
  const matchMedia = vi.fn(() => query as unknown as MediaQueryList);
  const change = (isMatching: boolean): void =>
    listeners.forEach((listener) => listener({ matches: isMatching } as MediaQueryListEvent));
  return { host: { matchMedia } as unknown as Window, matchMedia, change, listeners };
}

describe('reducedMotionPreference', () => {
  it('answers no preference on a host without matchMedia, rather than throwing', () => {
    expect(reducedMotionPreference(null, manualDestroyReference().ref)()).toBe(false);
    expect(reducedMotionPreference({} as Window, manualDestroyReference().ref)()).toBe(false);
  });

  it('reads the reduced-motion query and follows it as the setting changes', () => {
    const media = mediaHost(true);
    const prefers = reducedMotionPreference(media.host, manualDestroyReference().ref);
    expect(media.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
    expect(prefers()).toBe(true);
    media.change(false);
    expect(prefers()).toBe(false);
  });

  it('stops listening when its injector goes', () => {
    const media = mediaHost(false);
    const destroyReference = manualDestroyReference();
    reducedMotionPreference(media.host, destroyReference.ref);
    expect(media.listeners.size).toBe(1);
    destroyReference.destroy();
    expect(media.listeners.size).toBe(0);
  });
});
