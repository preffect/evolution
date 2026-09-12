import { describe, expect, it } from 'vitest';
import { INPUT_ACTION } from './keyboard-action';
import {
  IDLE_INPUT_STATE,
  steerVectorOf,
  withAction,
  withAllKeysReleased,
  withOneShotsTaken,
  withPointerAt,
  withQueuedCardDropped,
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

  it('queues the card a pick names', () => {
    expect(withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.pickCard, cardIndex: 2 }).queuedCardIndex).toBe(2);
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
  });
});

describe('taking the one-shots', () => {
  it('clears the sprint once it has been sent', () => {
    const sent = withOneShotsTaken(withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.sprint }), false);
    expect(sent.isSprintQueued).toBe(false);
  });

  it('keeps a card press that was not sent', () => {
    const queued = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    expect(withOneShotsTaken(queued, false).queuedCardIndex).toBe(1);
    expect(withOneShotsTaken(queued, true).queuedCardIndex).toBeNull();
  });

  it('drops a card press no offer can answer', () => {
    const queued = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    expect(withQueuedCardDropped(queued).queuedCardIndex).toBeNull();
    expect(withQueuedCardDropped(IDLE_INPUT_STATE)).toBe(IDLE_INPUT_STATE);
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
