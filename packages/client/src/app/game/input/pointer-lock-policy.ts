// The mouse lock's rules (docs/ui/input-and-onboarding.md §4.1, #794), as an immutable state and pure transitions so
// every case is a unit test: what a click on the canvas does while the pointer is not locked, why a lock was lost,
// and when the lock is handed back for an overlay that needs a real cursor. The adapter (`pointer-lock-input.ts`)
// gathers the facts, asks, and talks to the browser.

import type { ValueOf } from '@evolution/shared';
import {
  POINTER_LOCK_MAX_FAILED_REQUESTS,
  POINTER_LOCK_REQUEST_TIMEOUT_MS,
  POINTER_LOCK_RETRY_COOLDOWN_MS,
} from './input-constants';

export const POINTER_LOCK_PHASE = { unlocked: 'unlocked', requesting: 'requesting', locked: 'locked' } as const;
export type PointerLockPhase = ValueOf<typeof POINTER_LOCK_PHASE>;

export interface PointerLockState {
  readonly phase: PointerLockPhase;
  /** When the pending request was made; meaningful only while `requesting`. */
  readonly requestedAtMs: number;
  /** The page asked to leave the lock itself (an overlay, the room ending), so its loss is no Escape. */
  readonly isReleaseRequested: boolean;
  /** No request before this time: the browser's cooldown after a user exit or a failed request. */
  readonly retryAfterMs: number;
  /** Failed requests in a row; at `POINTER_LOCK_MAX_FAILED_REQUESTS` the lock gives up for the room. */
  readonly failedRequestCount: number;
}

export const IDLE_POINTER_LOCK_STATE: PointerLockState = {
  phase: POINTER_LOCK_PHASE.unlocked,
  requestedAtMs: 0,
  isReleaseRequested: false,
  retryAfterMs: 0,
  failedRequestCount: 0,
};

/** What the adapter knows at a click or a frame. */
export interface PointerLockFacts {
  /** The menu toggle is on and the browser has the Pointer Lock API. */
  readonly isEnabled: boolean;
  /** A menu, the encyclopedia or the results are up: the player needs the real cursor. */
  readonly isCursorNeeded: boolean;
  readonly nowMs: number;
}

/** What a primary press on the canvas does while the pointer is not locked. */
export const UNLOCKED_PRESS = {
  /** Today's click: the lock is off, unavailable, given up on, or not wanted over an overlay. */
  sprint: 'sprint',
  /** The locking click: it asks for the lock and does not also sprint. */
  requestLock: 'request_lock',
  /** A lock is on its way, or the browser's cooldown is running: the click neither locks nor sprints. */
  ignore: 'ignore',
} as const;
export type UnlockedPress = ValueOf<typeof UNLOCKED_PRESS>;

function hasGivenUp(state: PointerLockState): boolean {
  return state.failedRequestCount >= POINTER_LOCK_MAX_FAILED_REQUESTS;
}

function isRequestPending(state: PointerLockState, nowMs: number): boolean {
  return state.phase === POINTER_LOCK_PHASE.requesting && nowMs - state.requestedAtMs < POINTER_LOCK_REQUEST_TIMEOUT_MS;
}

/** A primary mouse press on the canvas while unlocked (a touch or a pen never reaches here: it always sprints). */
export function unlockedPressOutcome(state: PointerLockState, facts: PointerLockFacts): UnlockedPress {
  if (!facts.isEnabled || facts.isCursorNeeded || hasGivenUp(state)) return UNLOCKED_PRESS.sprint;
  if (isRequestPending(state, facts.nowMs) || facts.nowMs < state.retryAfterMs) return UNLOCKED_PRESS.ignore;
  return UNLOCKED_PRESS.requestLock;
}

/**
 * A request that timed out unanswered is a failure, settled before the next press is judged, so a browser that never
 * answers costs one ignored click per timeout and gives up at the cap like one that refuses.
 */
export function withStaleRequestSettled(state: PointerLockState, nowMs: number): PointerLockState {
  return state.phase === POINTER_LOCK_PHASE.requesting && !isRequestPending(state, nowMs)
    ? withRequestFailed(state, nowMs)
    : state;
}

export function withLockRequested(state: PointerLockState, nowMs: number): PointerLockState {
  return { ...state, phase: POINTER_LOCK_PHASE.requesting, requestedAtMs: nowMs, isReleaseRequested: false };
}

export function withLockAcquired(state: PointerLockState): PointerLockState {
  return { ...state, phase: POINTER_LOCK_PHASE.locked, isReleaseRequested: false, failedRequestCount: 0 };
}

/** The browser refused (or never answered): back to unlocked, waiting out the cooldown before the next try. */
export function withRequestFailed(state: PointerLockState, nowMs: number): PointerLockState {
  return {
    ...state,
    phase: POINTER_LOCK_PHASE.unlocked,
    retryAfterMs: nowMs + POINTER_LOCK_RETRY_COOLDOWN_MS,
    failedRequestCount: state.failedRequestCount + 1,
  };
}

/** Why a held lock went away. */
export const LOCK_LOSS = {
  /** The page let go: an overlay needs the cursor, the toggle went off, or the room ended. */
  released: 'released',
  /** The window lost focus (alt-tab, a click outside the browser): the window `blur` already released the keys. */
  focusLost: 'focus_lost',
  /** The player pressed Escape, which the browser keeps for itself while locked: treated as Escape, the menu opens. */
  userExit: 'user_exit',
} as const;
export type LockLoss = ValueOf<typeof LOCK_LOSS>;

export function lockLossOf(state: PointerLockState, hasDocumentFocus: boolean): LockLoss {
  if (state.isReleaseRequested) return LOCK_LOSS.released;
  return hasDocumentFocus ? LOCK_LOSS.userExit : LOCK_LOSS.focusLost;
}

/** Only a user exit starts the browser's cooldown; a release or a focus loss can be re-locked at the next click. */
export function withLockLost(state: PointerLockState, loss: LockLoss, nowMs: number): PointerLockState {
  return {
    ...state,
    phase: POINTER_LOCK_PHASE.unlocked,
    isReleaseRequested: false,
    retryAfterMs: loss === LOCK_LOSS.userExit ? nowMs + POINTER_LOCK_RETRY_COOLDOWN_MS : state.retryAfterMs,
  };
}

export function withReleaseRequested(state: PointerLockState): PointerLockState {
  return { ...state, isReleaseRequested: true };
}

/**
 * The page gives the lock back when an overlay needs the real cursor or the toggle went off. The trait picker is not
 * such an overlay: the lock stays through it (docs/ui/input-and-onboarding.md §4.1).
 */
export function shouldReleaseLock(state: PointerLockState, facts: PointerLockFacts): boolean {
  const isHeld = state.phase === POINTER_LOCK_PHASE.locked && !state.isReleaseRequested;
  return isHeld && (facts.isCursorNeeded || !facts.isEnabled);
}
