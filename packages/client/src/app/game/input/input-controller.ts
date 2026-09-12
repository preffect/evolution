// The client's input controller (docs/ARCHITECTURE.md §5, docs/UI.md §4): it owns the input
// state, the client tick counter and the one send per client tick. The adapters feed it decided
// actions, the world seam tells it what is alive and what is offered, and `pump()` — called once
// per animation frame — turns the elapsed time into whole `TICK_HZ` ticks through the injected
// clock. Nothing here reads the wall clock, a timer or `Math.random` (docs/DETERMINISM.md §1).

import {
  FixedStepAccumulator,
  MAX_TICKS_PER_ADVANCE,
  TICK_INTERVAL_MS,
  type Clock,
  type GameInput,
  type Vec2,
} from '@evolution/shared';
import { buildGameInput, type InputWorldContext } from './game-input-builder';
import type { SteerDirection } from './input-constants';
import { INPUT_ACTION, type InputAction } from './keyboard-action';
import {
  IDLE_INPUT_STATE,
  withAction,
  withAllKeysReleased,
  withOneShotsTaken,
  withPointerAt,
  withQueuedCardDropped,
  type CanvasPoint,
  type InputState,
} from './input-state';

export interface InputControllerDependencies {
  readonly clock: Clock;
  /** Sends one `player_input` (the multiplayer service's `sendInput`). */
  readonly send: (input: GameInput) => void;
  /** The latched pointer through the live camera; `null` before the renderer exists. */
  readonly screenToWorld: (point: CanvasPoint) => Vec2 | null;
  /** The own cell, the open offer and the live steer tunables; `null` before the first snapshot. */
  readonly world: () => InputWorldContext | null;
  /** Escape: the HUD closes the topmost overlay or opens the menu (docs/UI.md §3.5, #189). */
  readonly onMenuKey?: () => void;
}

/** What the dev-only debug hook reports about the input layer (docs/TESTING.md §8.3). */
export interface InputDebugState {
  readonly lastSentInput: GameInput | null;
  readonly heldSteerDirections: readonly SteerDirection[];
  readonly isFullLeaderboardHeld: boolean;
  readonly menuKeyPressCount: number;
  readonly pointerWorldPoint: Vec2 | null;
}

export class InputController {
  private state: InputState = IDLE_INPUT_STATE;
  private readonly accumulator: FixedStepAccumulator;
  /** The client tick counter: `sequence` is this, monotonic for the life of the controller. */
  private sequence = 0;
  /** The offer already answered, so exactly one pick is sent per offer (docs/UI.md §3.2). */
  private answeredOfferId: number | null = null;
  private lastSentInputValue: GameInput | null = null;
  private menuKeyPressCountValue = 0;

  constructor(private readonly dependencies: InputControllerDependencies) {
    this.accumulator = new FixedStepAccumulator(dependencies.clock, TICK_INTERVAL_MS, MAX_TICKS_PER_ADVANCE);
  }

  /** Folds one decided action in; `menu_key` is local and leaves the state alone. */
  apply(action: InputAction): void {
    if (action.kind === INPUT_ACTION.menuKey) {
      this.menuKeyPressCountValue += 1;
      this.dependencies.onMenuKey?.();
      return;
    }
    this.state = withAction(this.state, action);
  }

  pointerMovedTo(point: CanvasPoint): void {
    this.state = withPointerAt(this.state, point);
  }

  releaseAllKeys(): void {
    this.state = withAllKeysReleased(this.state);
  }

  /** Tab held (docs/UI.md §4): the HUD opens the full leaderboard while this is true. */
  isFullLeaderboardHeld(): boolean {
    return this.state.isFullLeaderboardHeld;
  }

  /** The latched pointer in world units, for the renderer's reticle (docs/RENDERING.md §7). */
  pointerWorldPoint(): Vec2 | null {
    const point = this.state.pointerCanvasPoint;
    return point === null ? null : this.dependencies.screenToWorld(point);
  }

  /**
   * One animation frame: sends one `GameInput` per client tick that came due. Before the first
   * snapshot there is no world to steer in and nothing is sent.
   */
  pump(): void {
    const world = this.dependencies.world();
    if (world === null) return;
    if (world.offer === null || world.offer.offerId === this.answeredOfferId) {
      this.state = withQueuedCardDropped(this.state);
    }
    const dueTicks = this.accumulator.dueTicks();
    for (let tick = 0; tick < dueTicks; tick += 1) {
      this.sendOneTick(world);
    }
  }

  private sendOneTick(world: InputWorldContext): void {
    this.sequence += 1;
    const input = buildGameInput({
      state: this.state,
      sequence: this.sequence,
      world,
      pointerWorldPoint: this.pointerWorldPoint(),
    });
    const wasCardSent = input.traitChoice !== null;
    if (input.traitChoice !== null) this.answeredOfferId = input.traitChoice.offerId;
    this.state = withOneShotsTaken(this.state, wasCardSent);
    this.lastSentInputValue = input;
    this.dependencies.send(input);
  }

  debugState(): InputDebugState {
    return {
      lastSentInput: this.lastSentInputValue,
      heldSteerDirections: this.state.heldSteerDirections,
      isFullLeaderboardHeld: this.state.isFullLeaderboardHeld,
      menuKeyPressCount: this.menuKeyPressCountValue,
      pointerWorldPoint: this.pointerWorldPoint(),
    };
  }
}
