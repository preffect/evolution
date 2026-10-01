// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  POINTER_LOCK_MAX_FAILED_REQUESTS,
  POINTER_LOCK_REQUEST_TIMEOUT_MS,
  POINTER_LOCK_RETRY_COOLDOWN_MS,
} from './input-constants';
import {
  IDLE_POINTER_LOCK_STATE,
  LOCK_LOSS,
  POINTER_LOCK_PHASE,
  UNLOCKED_PRESS,
  lockLossOf,
  shouldReleaseLock,
  unlockedPressOutcome,
  withLockAcquired,
  withLockLost,
  withLockRequested,
  withReleaseRequested,
  withRequestFailed,
  withStaleRequestSettled,
  type PointerLockFacts,
  type PointerLockState,
} from './pointer-lock-policy';

const NOW_MS = 10_000;
const FACTS: PointerLockFacts = { isEnabled: true, isCursorNeeded: false, nowMs: NOW_MS };
const LOCKED = withLockAcquired(withLockRequested(IDLE_POINTER_LOCK_STATE, NOW_MS));

function failedTimes(count: number): PointerLockState {
  let state = IDLE_POINTER_LOCK_STATE;
  for (let attempt = 0; attempt < count; attempt += 1) state = withRequestFailed(state, NOW_MS);
  return state;
}

describe('unlockedPressOutcome', () => {
  it('asks for the lock on the first click, which therefore does not sprint', () => {
    expect(unlockedPressOutcome(IDLE_POINTER_LOCK_STATE, FACTS)).toBe(UNLOCKED_PRESS.requestLock);
  });

  it('sprints as it always did when the toggle is off or an overlay needs the cursor', () => {
    expect(unlockedPressOutcome(IDLE_POINTER_LOCK_STATE, { ...FACTS, isEnabled: false })).toBe(UNLOCKED_PRESS.sprint);
    expect(unlockedPressOutcome(IDLE_POINTER_LOCK_STATE, { ...FACTS, isCursorNeeded: true })).toBe(
      UNLOCKED_PRESS.sprint,
    );
  });

  it('ignores a click while a request is on its way, until the request times out', () => {
    const requesting = withLockRequested(IDLE_POINTER_LOCK_STATE, NOW_MS);
    expect(unlockedPressOutcome(requesting, FACTS)).toBe(UNLOCKED_PRESS.ignore);
    const late = NOW_MS + POINTER_LOCK_REQUEST_TIMEOUT_MS;
    expect(unlockedPressOutcome(requesting, { ...FACTS, nowMs: late - 1 })).toBe(UNLOCKED_PRESS.ignore);
    expect(unlockedPressOutcome(requesting, { ...FACTS, nowMs: late })).toBe(UNLOCKED_PRESS.requestLock);
  });

  it('waits out the browser cooldown after an Escape exit, ignoring clicks rather than spamming requests', () => {
    const exited = withLockLost(LOCKED, LOCK_LOSS.userExit, NOW_MS);
    const cooldownEnd = NOW_MS + POINTER_LOCK_RETRY_COOLDOWN_MS;
    expect(unlockedPressOutcome(exited, { ...FACTS, nowMs: cooldownEnd - 1 })).toBe(UNLOCKED_PRESS.ignore);
    expect(unlockedPressOutcome(exited, { ...FACTS, nowMs: cooldownEnd })).toBe(UNLOCKED_PRESS.requestLock);
  });

  it('re-locks at once after a focus loss or a release, which start no cooldown', () => {
    for (const loss of [LOCK_LOSS.focusLost, LOCK_LOSS.released]) {
      expect(unlockedPressOutcome(withLockLost(LOCKED, loss, NOW_MS), FACTS)).toBe(UNLOCKED_PRESS.requestLock);
    }
  });

  it('gives up after the failure cap, so a browser that never grants still sprints on a click', () => {
    const after = { ...FACTS, nowMs: NOW_MS + POINTER_LOCK_RETRY_COOLDOWN_MS };
    expect(unlockedPressOutcome(failedTimes(POINTER_LOCK_MAX_FAILED_REQUESTS - 1), after)).toBe(
      UNLOCKED_PRESS.requestLock,
    );
    expect(unlockedPressOutcome(failedTimes(POINTER_LOCK_MAX_FAILED_REQUESTS), after)).toBe(UNLOCKED_PRESS.sprint);
  });
});

describe('the request transitions', () => {
  it('counts a refusal and starts the cooldown; a grant clears the count', () => {
    const failed = withRequestFailed(withLockRequested(IDLE_POINTER_LOCK_STATE, NOW_MS), NOW_MS);
    expect(failed).toMatchObject({
      phase: POINTER_LOCK_PHASE.unlocked,
      failedRequestCount: 1,
      retryAfterMs: NOW_MS + POINTER_LOCK_RETRY_COOLDOWN_MS,
    });
    expect(withLockAcquired(withLockRequested(failed, NOW_MS)).failedRequestCount).toBe(0);
  });

  it('settles an unanswered request as a failure once it times out, and leaves a fresh one alone', () => {
    const requesting = withLockRequested(IDLE_POINTER_LOCK_STATE, NOW_MS);
    expect(withStaleRequestSettled(requesting, NOW_MS + 1)).toBe(requesting);
    const settled = withStaleRequestSettled(requesting, NOW_MS + POINTER_LOCK_REQUEST_TIMEOUT_MS);
    expect(settled).toMatchObject({ phase: POINTER_LOCK_PHASE.unlocked, failedRequestCount: 1 });
    expect(withStaleRequestSettled(LOCKED, NOW_MS + POINTER_LOCK_REQUEST_TIMEOUT_MS)).toBe(LOCKED);
  });
});

describe('lockLossOf', () => {
  it('names a loss the page asked for a release, whatever the focus', () => {
    expect(lockLossOf(withReleaseRequested(LOCKED), true)).toBe(LOCK_LOSS.released);
    expect(lockLossOf(withReleaseRequested(LOCKED), false)).toBe(LOCK_LOSS.released);
  });

  it('tells an Escape (focus kept) from a focus loss', () => {
    expect(lockLossOf(LOCKED, true)).toBe(LOCK_LOSS.userExit);
    expect(lockLossOf(LOCKED, false)).toBe(LOCK_LOSS.focusLost);
  });

  it('clears the release request with the loss, so the next lock starts clean', () => {
    const lost = withLockLost(withReleaseRequested(LOCKED), LOCK_LOSS.released, NOW_MS);
    expect(lost).toMatchObject({ phase: POINTER_LOCK_PHASE.unlocked, isReleaseRequested: false });
  });
});

describe('shouldReleaseLock', () => {
  it('hands the lock back for an overlay that needs the cursor, or the toggle going off', () => {
    expect(shouldReleaseLock(LOCKED, FACTS)).toBe(false);
    expect(shouldReleaseLock(LOCKED, { ...FACTS, isCursorNeeded: true })).toBe(true);
    expect(shouldReleaseLock(LOCKED, { ...FACTS, isEnabled: false })).toBe(true);
  });

  it('asks once: not again while the release is in flight, and never without a lock', () => {
    const needsCursor = { ...FACTS, isCursorNeeded: true };
    expect(shouldReleaseLock(withReleaseRequested(LOCKED), needsCursor)).toBe(false);
    expect(shouldReleaseLock(IDLE_POINTER_LOCK_STATE, needsCursor)).toBe(false);
  });
});
