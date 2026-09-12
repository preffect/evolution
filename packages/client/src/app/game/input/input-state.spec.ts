import { describe, expect, it } from 'vitest';
import { INPUT_ACTION } from './keyboard-action';
import {
  IDLE_INPUT_STATE,
  steerVectorOf,
  withAction,
  withAllKeysReleased,
  withPendingPressesDropped,
  withPickDropped,
  withPickQueued,
  withPickSent,
  withPointerAt,
  withSprintTaken,
  type InputState,
} from './input-state';
import type { SteerDirection } from './input-constants';

function held(...directions: SteerDirection[]): InputState {
  return directions.reduce(
    (state, direction) => withAction(state, { kind: INPUT_ACTION.steer, direction, isPressed: true }),
    IDLE_INPUT_STATE,
  );
}

const DIAGONAL_COMPONENT = Math.SQRT1_2;

describe('the input state', () => {
  it('latches the pointer where it last was', () => {
    expect(withPointerAt(IDLE_INPUT_STATE, { x: 12, y: 34 }).pointerCanvasPoint).toEqual({ x: 12, y: 34 });
  });

  it('queues a sprint on a press', () => {
    expect(withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.sprint }).isSprintQueued).toBe(true);
  });

  it('holds and releases the full leaderboard', () => {
    const holding = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.holdFullLeaderboard });
    expect(holding.isFullLeaderboardHeld).toBe(true);
    expect(withAction(holding, { kind: INPUT_ACTION.releaseFullLeaderboard }).isFullLeaderboardHeld).toBe(false);
  });

  it('records a steer key once however often it repeats', () => {
    const twice = withAction(held('up'), { kind: INPUT_ACTION.steer, direction: 'up', isPressed: true });
    expect(twice.heldSteerDirections).toEqual(['up']);
  });

  it('drops a steer key on its release', () => {
    const released = withAction(held('up', 'left'), { kind: INPUT_ACTION.steer, direction: 'up', isPressed: false });
    expect(released.heldSteerDirections).toEqual(['left']);
  });

  it('releases everything when the window loses focus', () => {
    const blurred = withAllKeysReleased(withAction(held('up'), { kind: INPUT_ACTION.holdFullLeaderboard }));
    expect(blurred.heldSteerDirections).toEqual([]);
    expect(blurred.isFullLeaderboardHeld).toBe(false);
  });

  it('leaves the state alone for an action it does not own', () => {
    expect(withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.menuKey })).toBe(IDLE_INPUT_STATE);
    expect(withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.pickCard, cardIndex: 1 })).toBe(IDLE_INPUT_STATE);
  });
});

describe('the pending presses', () => {
  const queuedPick = { offerId: 5, cardIndex: 1, sentAtSequence: null };

  it('clears the sprint once it has been sent', () => {
    const sent = withSprintTaken(withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.sprint }));
    expect(sent.isSprintQueued).toBe(false);
    expect(withSprintTaken(IDLE_INPUT_STATE)).toBe(IDLE_INPUT_STATE);
  });

  it('holds the queued pick with the offer it answers', () => {
    expect(withPickQueued(IDLE_INPUT_STATE, queuedPick).queuedPick).toEqual(queuedPick);
  });

  it('stamps the queued pick with the sequence it was sent with, so a retry can be timed', () => {
    const sent = withPickSent(withPickQueued(IDLE_INPUT_STATE, queuedPick), 42);
    expect(sent.queuedPick).toEqual({ ...queuedPick, sentAtSequence: 42 });
    expect(withPickSent(IDLE_INPUT_STATE, 42)).toBe(IDLE_INPUT_STATE);
  });

  it('drops the queued pick once its offer is gone', () => {
    expect(withPickDropped(withPickQueued(IDLE_INPUT_STATE, queuedPick)).queuedPick).toBeNull();
    expect(withPickDropped(IDLE_INPUT_STATE)).toBe(IDLE_INPUT_STATE);
  });

  it('drops both pending presses when there is nothing to steer', () => {
    let state = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.sprint });
    state = withPickQueued(state, queuedPick);
    const dropped = withPendingPressesDropped(state);
    expect(dropped.isSprintQueued).toBe(false);
    expect(dropped.queuedPick).toBeNull();
  });
});

describe('steerVectorOf', () => {
  it('is null with no key held', () => {
    expect(steerVectorOf(IDLE_INPUT_STATE)).toBeNull();
  });

  it('points up the screen for W, which is world −y', () => {
    expect(steerVectorOf(held('up'))).toEqual({ x: 0, y: -1 });
  });

  it('normalises a diagonal so two keys are no faster than one', () => {
    const diagonal = steerVectorOf(held('up', 'right'));
    expect(diagonal?.x).toBeCloseTo(DIAGONAL_COMPONENT);
    expect(diagonal?.y).toBeCloseTo(-DIAGONAL_COMPONENT);
  });

  it('is null when two keys cancel out', () => {
    expect(steerVectorOf(held('left', 'right'))).toBeNull();
  });
});
