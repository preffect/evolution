// What the input layer remembers between client ticks (docs/UI.md §4): the latched pointer, the
// held steer keys, the two one-shots waiting to be sent and the Tab hold. Immutable and pure —
// every transition returns a new state, so a test names the transition and asserts the value.

import type { Vec2 } from '@evolution/shared';
import { INPUT_ACTION, type InputAction } from './keyboard-action';
import { STEER_VECTORS, type SteerDirection } from './input-constants';

/** A point in CSS px relative to the canvas host's top-left corner. */
export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface InputState {
  /** The pointer's last position over the canvas; latched when it leaves (docs/UI.md §4). */
  readonly pointerCanvasPoint: CanvasPoint | null;
  /** The steer keys down right now, in press order. */
  readonly heldSteerDirections: readonly SteerDirection[];
  /** A sprint press not yet sent: edge-triggered, one per press. */
  readonly isSprintQueued: boolean;
  /** The card a `1` `2` `3` press asked for and that has not been sent yet. */
  readonly queuedCardIndex: number | null;
  /** Tab is held, so the full leaderboard is open (docs/UI.md §4). */
  readonly isFullLeaderboardHeld: boolean;
}

export const IDLE_INPUT_STATE: InputState = {
  pointerCanvasPoint: null,
  heldSteerDirections: [],
  isSprintQueued: false,
  queuedCardIndex: null,
  isFullLeaderboardHeld: false,
};

export function withPointerAt(state: InputState, point: CanvasPoint): InputState {
  return { ...state, pointerCanvasPoint: point };
}

function withSteerKey(state: InputState, direction: SteerDirection, isPressed: boolean): InputState {
  const withoutDirection = state.heldSteerDirections.filter((held) => held !== direction);
  return { ...state, heldSteerDirections: isPressed ? [...withoutDirection, direction] : withoutDirection };
}

/** Folds one decided action into the state; an action the state does not own leaves it as it was. */
export function withAction(state: InputState, action: InputAction): InputState {
  switch (action.kind) {
    case INPUT_ACTION.steer: {
      return withSteerKey(state, action.direction, action.isPressed);
    }
    case INPUT_ACTION.sprint: {
      return { ...state, isSprintQueued: true };
    }
    case INPUT_ACTION.pickCard: {
      return { ...state, queuedCardIndex: action.cardIndex };
    }
    case INPUT_ACTION.holdFullLeaderboard: {
      return { ...state, isFullLeaderboardHeld: true };
    }
    case INPUT_ACTION.releaseFullLeaderboard: {
      return { ...state, isFullLeaderboardHeld: false };
    }
    default: {
      return state;
    }
  }
}

/** Every key up: what a lost window focus means, so nothing stays held while the page is away. */
export function withAllKeysReleased(state: InputState): InputState {
  return { ...state, heldSteerDirections: [], isFullLeaderboardHeld: false };
}

/** Clears the one-shots that were just sent; a card press is kept until the pick actually goes out. */
export function withOneShotsTaken(state: InputState, wasCardSent: boolean): InputState {
  return { ...state, isSprintQueued: false, queuedCardIndex: wasCardSent ? null : state.queuedCardIndex };
}

/** Drops a card press that no open offer can answer (docs/UI.md §3.2: one send per offer). */
export function withQueuedCardDropped(state: InputState): InputState {
  return state.queuedCardIndex === null ? state : { ...state, queuedCardIndex: null };
}

/**
 * The unit vector the held keys point along, or `null` when none is held or they cancel out
 * (`A` and `D` together). Diagonals are normalised, so two keys are no faster than one.
 */
export function steerVectorOf(state: InputState): Vec2 | null {
  let sumX = 0;
  let sumY = 0;
  for (const direction of state.heldSteerDirections) {
    sumX += STEER_VECTORS[direction].x;
    sumY += STEER_VECTORS[direction].y;
  }
  const length = Math.hypot(sumX, sumY);
  return length === 0 ? null : { x: sumX / length, y: sumY / length };
}
