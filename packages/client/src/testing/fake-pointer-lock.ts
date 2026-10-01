// A stand-in for the browser's Pointer Lock API (docs/ui/input-and-onboarding.md §4.1, #794), which jsdom does not
// have. It installs `requestPointerLock` on one element and `pointerLockElement` / `exitPointerLock` / `hasFocus` /
// `elementFromPoint` on its document, and lets a spec play the browser's part: grant or refuse a request, and take the
// lock away as an Escape or a focus loss would. `exitPointerLock` unlocks at once and fires `pointerlockchange`, as
// browsers do a moment later.

import { vi } from 'vitest';

export interface FakePointerLock {
  /** Every `requestPointerLock` call, with the options it passed. */
  readonly requests: ReturnType<typeof vi.fn>;
  readonly exits: ReturnType<typeof vi.fn>;
  /** The browser grants the pending request: the element is locked and `pointerlockchange` fires. */
  grant(): void;
  /** The browser refuses it: `pointerlockerror` fires. */
  refuse(): void;
  /** The browser drops the lock: Escape (the document keeps focus) or a focus loss (it does not). */
  unlock(options: { readonly hasDocumentFocus: boolean }): void;
  /** What `elementFromPoint` answers from now on; the locked element until set. */
  setElementAtPoint(element: Element | null): void;
  restore(): void;
}

const DOCUMENT_STUBS = ['pointerLockElement', 'exitPointerLock', 'elementFromPoint'] as const;

export function installFakePointerLock(element: HTMLElement): FakePointerLock {
  const ownerDocument = element.ownerDocument;
  let locked: Element | null = null;
  let hasFocus = true;
  let elementAtPoint: Element | null = element;
  const setLocked = (next: Element | null): void => {
    locked = next;
    ownerDocument.dispatchEvent(new Event('pointerlockchange'));
  };
  const requests = vi.fn(() => Promise.resolve());
  const exits = vi.fn(() => {
    if (locked !== null) setLocked(null);
  });
  Object.defineProperty(element, 'requestPointerLock', { configurable: true, value: requests });
  Object.defineProperty(ownerDocument, 'pointerLockElement', { configurable: true, get: () => locked });
  Object.defineProperty(ownerDocument, 'exitPointerLock', { configurable: true, value: exits });
  Object.defineProperty(ownerDocument, 'elementFromPoint', { configurable: true, value: () => elementAtPoint });
  const hasFocusSpy = vi.spyOn(ownerDocument, 'hasFocus').mockImplementation(() => hasFocus);
  return {
    requests,
    exits,
    grant: () => setLocked(element),
    refuse: () => ownerDocument.dispatchEvent(new Event('pointerlockerror')),
    unlock: ({ hasDocumentFocus }) => {
      hasFocus = hasDocumentFocus;
      setLocked(null);
      hasFocus = true;
    },
    setElementAtPoint: (next) => {
      elementAtPoint = next;
    },
    restore: () => {
      Reflect.deleteProperty(element, 'requestPointerLock');
      for (const name of DOCUMENT_STUBS) Reflect.deleteProperty(ownerDocument, name);
      hasFocusSpy.mockRestore();
    },
  };
}
