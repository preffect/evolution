// What the input layer remembers between client ticks (docs/UI.md §4): the latched pointer, the
// held steer keys, the two one-shots waiting to be sent and the Tab hold. Immutable and pure —
// every transition returns a new state, so a test names the transition and asserts the value.

import type { Vec2 } from '@evolution/shared';
import { INPUT_ACTION, type InputAction } from './keyboard-action';
import { STEER_VECTORS, type SteerDirection } from './input-constants';
import type { QueuedTraitPick } from './trait-pick';

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
  /** The `1` `2` `3` press waiting to be answered, bound to the offer it was made against. */
  readonly queuedPick: QueuedTraitPick | null;
  /** Tab is held, so the full leaderboard is open (docs/UI.md §4). */
  readonly isFullLeaderboardHeld: boolean;
}

export const IDLE_INPUT_STATE: InputState = {
  pointerCanvasPoint: null,
  heldSteerDirections: [],
  isSprintQueued: false,
  queuedPick: null,
  isFullLeaderboardHeld: false,
};

export function withPointerAt(state: InputState, point: CanvasPoint): InputState {
  return { ...state, pointerCanvasPoint: point };
}

function withSteerKey(state: InputState, direction: SteerDirection, isPressed: boolean): InputState {
  const withoutDirection = state.heldSteerDirections.filter((held) => held !== direction);
  return { ...state, heldSteerDirections: isPressed ? [...withoutDirection, direction] : withoutDirection };
}

/**
 * Folds one decided action into the state; an action the state does not own leaves it as it was.
 * `pick_card` and `menu_key` are among those: a card press has to be resolved against the offer
 * that is open now before it can be stored (`trait-pick.ts`), and Escape is the HUD's.
 */
export function withAction(state: InputState, action: InputAction): InputState {
  switch (action.kind) {
    case INPUT_ACTION.steer: {
      return withSteerKey(state, action.direction, action.isPressed);
    }
    case INPUT_ACTION.sprint: {
      return { ...state, isSprintQueued: true };
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

/** The queued answer to the offer that was open when the key was pressed (`trait-pick.ts`). */
export function withPickQueued(state: InputState, pick: QueuedTraitPick): InputState {
  return { ...state, queuedPick: pick };
}

/** Stamps the queued pick with the `sequence` it has just been sent with, so a retry can be timed. */
export function withPickSent(state: InputState, sequence: number): InputState {
  return state.queuedPick === null
    ? state
    : { ...state, queuedPick: { ...state.queuedPick, sentAtSequence: sequence } };
}

/** Drops the queued pick: the offer it answers is gone (`trait-pick.ts`, case 2 and 3). */
export function withPickDropped(state: InputState): InputState {
  return state.queuedPick === null ? state : { ...state, queuedPick: null };
}

/** Clears the sprint one-shot once it has been sent: one sprint per press (docs/UI.md §4). */
export function withSprintTaken(state: InputState): InputState {
  return state.isSprintQueued ? { ...state, isSprintQueued: false } : state;
}

/**
 * Everything a press had pending, dropped: what a stretch with nothing to steer means (the lobby,
 * the results phase). A press made then is not carried into the next round (docs/UI.md §4).
 */
export function withPendingPressesDropped(state: InputState): InputState {
  return withPickDropped(withSprintTaken(state));
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
