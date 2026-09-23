// The reader's `prefers-reduced-motion` in code (docs/ui/encyclopedia.md §11.4): every other use of the preference is a
// CSS `@media` block, but pausing a preview is a method call, so the client reads it once here. The same shape as
// `clock-provider.ts`: a root token every caller shares and a spec overrides.

import { DOCUMENT } from '@angular/common';
import { DestroyRef, InjectionToken, inject, signal, type Signal } from '@angular/core';

/** The media query the preference is read through. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The media query events the preference follows; a host that lacks it answers "no preference". */
type MediaQueryHost = Pick<Window, 'matchMedia'> | null;

/**
 * Whether the reader asked for reduced motion, following the setting as it changes. A host with no `matchMedia`
 * (jsdom, a server render) answers `false` rather than throwing.
 */
export function reducedMotionPreference(host: MediaQueryHost, destroyReference: DestroyRef): Signal<boolean> {
  if (host === null || typeof host.matchMedia !== 'function') return signal(false).asReadonly();
  const query = host.matchMedia(REDUCED_MOTION_QUERY);
  const prefersReducedMotion = signal(query.matches);
  const follow = (event: MediaQueryListEvent): void => prefersReducedMotion.set(event.matches);
  query.addEventListener('change', follow);
  destroyReference.onDestroy(() => query.removeEventListener('change', follow));
  return prefersReducedMotion.asReadonly();
}

export const REDUCED_MOTION = new InjectionToken<Signal<boolean>>('ReducedMotion', {
  providedIn: 'root',
  factory: () => reducedMotionPreference(inject(DOCUMENT).defaultView, inject(DestroyRef)),
});
