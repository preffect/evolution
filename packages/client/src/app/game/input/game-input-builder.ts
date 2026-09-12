// One client tick's `GameInput` (docs/ARCHITECTURE.md §4, docs/UI.md §4): the latched pointer or
// the held keys become `targetX/targetY`, the queued press becomes `shouldSprint`, and a `1` `2`
// `3` press becomes `traitChoice` for the offer that is actually open. Pure — the controller owns
// the state and the sequence, this owns the mapping.

import type { GameInput, SteerBalance, TraitChoiceInput, TraitOfferView, Vec2 } from '@evolution/shared';
import type { PointerProjection } from '../render/render-session';
import { DISH_CENTRE_POINT } from './input-constants';
import { steerVectorOf, type InputState } from './input-state';
import { TRAIT_PICK_STATUS, traitPickStatus } from './trait-pick';

/** The own cell's pose, as the steer target needs it. */
export interface OwnCellPose {
  readonly x: number;
  readonly y: number;
  readonly radiusWu: number;
}

/** What the world tells the input layer each tick; `null` fields are "not yet" or "not alive". */
export interface InputWorldContext {
  /** The own cell, or `null` while dead, spectating or before the first snapshot. */
  readonly ownCell: OwnCellPose | null;
  /** The own player's open trait offer (docs/PROGRESSION.md §4). */
  readonly offer: TraitOfferView | null;
  /** The live steer tunables from `game_state.balance`; the client never keeps its own copy. */
  readonly controls: SteerBalance;
  /**
   * The newest `sequence` the server has applied for this player (docs/ARCHITECTURE.md §4). A
   * reconnect keeps the server's player record but gives the page a fresh controller, so the
   * controller starts its counter above this or every input is dropped as stale.
   */
  readonly appliedInputSequence: number;
}

export interface GameInputBuildOptions {
  readonly state: InputState;
  /** The client tick this input is for: monotonic, echoed back for prediction (docs/ARCHITECTURE.md §5). */
  readonly sequence: number;
  readonly world: InputWorldContext;
  /** The latched pointer through the live camera; `null` before the renderer exists. */
  readonly pointer: PointerProjection | null;
}

/**
 * Keyboard steering synthesises a target `STEER_FULL_THROTTLE_RADII × radius` ahead of the cell
 * (docs/GAME-DESIGN.md §6), so a held key is full throttle exactly as a distant pointer is.
 */
export function keyboardSteerTarget(ownCell: OwnCellPose, direction: Vec2, controls: SteerBalance): Vec2 {
  const reachWu = controls.STEER_FULL_THROTTLE_RADII * ownCell.radiusWu;
  return { x: ownCell.x + direction.x * reachWu, y: ownCell.y + direction.y * reachWu };
}

/**
 * Where the cell is asked to swim: the held keys win over the pointer, the latched pointer wins
 * over standing still, and standing still is the cell's own centre (throttle 0, docs/GAME-DESIGN.md §6).
 *
 * The pointer is sent as **its offset from the middle of the view, applied to the newest
 * snapshot's own cell** — not as the absolute world point the camera projects it to. The camera
 * centres on the *interpolated* cell and then smooths, so it trails the authoritative one by
 * `INTERPOLATION_DELAY_TICKS` plus `CAMERA_FOLLOW_SECONDS`, and an absolute target would have
 * that lag distance subtracted from the offset the player aimed for. At `CELL_STARTING_MASS`
 * that is most of the throttle ramp of `ECOLOGY.md §5.2`, so a new cell would be full speed or
 * stopped with nothing in between. Full prediction of the own cell stays #265.
 */
export function steerTargetFor(options: GameInputBuildOptions): Vec2 {
  const { ownCell, controls } = options.world;
  const keyDirection = steerVectorOf(options.state);
  if (keyDirection !== null && ownCell !== null) return keyboardSteerTarget(ownCell, keyDirection, controls);
  const { pointer } = options;
  if (pointer === null) return ownCell === null ? DISH_CENTRE_POINT : { x: ownCell.x, y: ownCell.y };
  // With no own cell there is nothing to steer and nothing to anchor to: the camera's own
  // projection is the only meaningful answer, and the server ignores it.
  if (ownCell === null) return pointer.worldPoint;
  return {
    x: ownCell.x + pointer.offsetFromViewCentre.x,
    y: ownCell.y + pointer.offsetFromViewCentre.y,
  };
}

/** The pick to send this tick, or `null`. The whole policy is `trait-pick.ts`. */
export function traitChoiceFor(state: InputState, world: InputWorldContext): TraitChoiceInput | null {
  const pick = state.queuedPick;
  if (pick === null || traitPickStatus(pick, world) !== TRAIT_PICK_STATUS.send) return null;
  return { offerId: pick.offerId, cardIndex: pick.cardIndex };
}

export function buildGameInput(options: GameInputBuildOptions): GameInput {
  const target = steerTargetFor(options);
  return {
    sequence: options.sequence,
    targetX: target.x,
    targetY: target.y,
    shouldSprint: options.state.isSprintQueued,
    traitChoice: traitChoiceFor(options.state, options.world),
  };
}
