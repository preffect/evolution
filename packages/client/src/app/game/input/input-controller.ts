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
import { TRAIT_PICK_STATUS, traitPickFor, traitPickStatus, type QueuedTraitPick } from './trait-pick';
import type { PointerProjection } from '../render/render-session';
import type { SteerDirection } from './input-constants';
import { INPUT_ACTION, type InputAction } from './keyboard-action';
import {
  IDLE_INPUT_STATE,
  withAction,
  withAllKeysReleased,
  withPendingPressesDropped,
  withPickDropped,
  withPickQueued,
  withPickSent,
  withPointerAt,
  withSprintTaken,
  type CanvasPoint,
  type InputState,
} from './input-state';

export interface InputControllerDependencies {
  readonly clock: Clock;
  /** Sends one `player_input` (the multiplayer service's `sendInput`). */
  readonly send: (input: GameInput) => void;
  /** The latched pointer through the live camera; `null` before the renderer exists. */
  readonly projectPointer: (point: CanvasPoint) => PointerProjection | null;
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
  /** The `1` `2` `3` press still waiting on its offer (`trait-pick.ts`). */
  readonly queuedPick: QueuedTraitPick | null;
  /** The offer the client model shows as open, so a QA run can tell "no offer" from "not wired". */
  readonly openOfferId: number | null;
}

export class InputController {
  private state: InputState = IDLE_INPUT_STATE;
  private readonly accumulator: FixedStepAccumulator;
  /** The client tick counter: `sequence` is this, monotonic for the life of the controller. */
  private sequence = 0;
  private lastSentInputValue: GameInput | null = null;
  private menuKeyPressCountValue = 0;

  constructor(private readonly dependencies: InputControllerDependencies) {
    this.accumulator = new FixedStepAccumulator(dependencies.clock, TICK_INTERVAL_MS, MAX_TICKS_PER_ADVANCE);
  }

  /**
   * Folds one decided action in. `menu_key` is the HUD's and leaves the state alone; a card press
   * is bound to the offer that is open at the moment it is made, and one no open offer can answer
   * is discarded there and then rather than carried to a later offer (`trait-pick.ts`).
   */
  apply(action: InputAction): void {
    if (action.kind === INPUT_ACTION.menuKey) {
      this.menuKeyPressCountValue += 1;
      this.dependencies.onMenuKey?.();
      return;
    }
    if (action.kind === INPUT_ACTION.pickCard) {
      const pick = traitPickFor(action.cardIndex, this.dependencies.world()?.offer ?? null);
      if (pick !== null) this.state = withPickQueued(this.state, pick);
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

  /** The latched pointer through the live camera, or `null` before one exists. */
  private projectedPointer(): PointerProjection | null {
    const point = this.state.pointerCanvasPoint;
    return point === null ? null : this.dependencies.projectPointer(point);
  }

  /** The latched pointer in world units, for the renderer's reticle (docs/RENDERING.md §7). */
  pointerWorldPoint(): Vec2 | null {
    return this.projectedPointer()?.worldPoint ?? null;
  }

  /**
   * One animation frame: sends one `GameInput` per client tick that came due. With nothing to
   * steer — before the first snapshot, and through the results phase — nothing is sent, the
   * pending presses are dropped rather than carried into the next round, and the accumulator is
   * resynced so that stretch is not owed and does not burst on the frame the world returns.
   */
  pump(): void {
    const world = this.dependencies.world();
    if (world === null) {
      this.state = withPendingPressesDropped(this.state);
      this.accumulator.discardElapsed();
      return;
    }
    if (this.state.queuedPick !== null && traitPickStatus(this.state.queuedPick, world) === TRAIT_PICK_STATUS.discard) {
      this.state = withPickDropped(this.state);
    }
    const dueTicks = this.accumulator.dueTicks();
    // One projection for the whole frame: the camera does not move between the ticks it owes.
    const pointer = this.projectedPointer();
    for (let tick = 0; tick < dueTicks; tick += 1) {
      this.sendOneTick(world, pointer);
    }
  }

  private sendOneTick(world: InputWorldContext, pointer: PointerProjection | null): void {
    // Never behind what the server has already applied: a reconnect hands the page a fresh
    // controller against the same player record, whose `appliedInputSequence` is far ahead
    // (docs/ARCHITECTURE.md §4, §5). Normally the applied sequence trails and this is a no-op.
    // `isStaleInput` also rejects against the server's pending input, which is not on the wire;
    // that half needs no handling here, since pending drains every tick and a reconnect finds it
    // empty, while our own counter is always ahead of anything we have sent.
    this.sequence = Math.max(this.sequence, world.appliedInputSequence) + 1;
    const input = buildGameInput({ state: this.state, sequence: this.sequence, world, pointer });
    this.state = withSprintTaken(this.state);
    if (input.traitChoice !== null) this.state = withPickSent(this.state, this.sequence);
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
      queuedPick: this.state.queuedPick,
      openOfferId: this.dependencies.world()?.offer?.offerId ?? null,
    };
  }
}
