// One client tick's `GameInput` (docs/ARCHITECTURE.md §4, docs/UI.md §4): the latched pointer or
// the held keys become `targetX/targetY`, the queued press becomes `shouldSprint`, and a `1` `2`
// `3` press becomes `traitChoice` for the offer that is actually open. Pure — the controller owns
// the state and the sequence, this owns the mapping.

import type { GameInput, SteerBalance, TraitChoiceInput, TraitOfferView, Vec2 } from '@evolution/shared';
import { DISH_CENTRE_POINT } from './input-constants';
import { steerVectorOf, type InputState } from './input-state';

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
}

export interface GameInputBuildOptions {
  readonly state: InputState;
  /** The client tick this input is for: monotonic, echoed back for prediction (docs/ARCHITECTURE.md §5). */
  readonly sequence: number;
  readonly world: InputWorldContext;
  /** The latched pointer in world units through the live camera; `null` before the renderer exists. */
  readonly pointerWorldPoint: Vec2 | null;
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
 */
export function steerTargetFor(options: GameInputBuildOptions): Vec2 {
  const { ownCell, controls } = options.world;
  const keyDirection = steerVectorOf(options.state);
  if (keyDirection !== null && ownCell !== null) return keyboardSteerTarget(ownCell, keyDirection, controls);
  if (options.pointerWorldPoint !== null) return options.pointerWorldPoint;
  return ownCell === null ? DISH_CENTRE_POINT : { x: ownCell.x, y: ownCell.y };
}

/**
 * The pick to send, or `null`: a queued press answers the offer that is open now, and only when
 * the card exists in it. Sending once per offer is the controller's (`sentOfferId`).
 */
export function traitChoiceFor(state: InputState, offer: TraitOfferView | null): TraitChoiceInput | null {
  if (state.queuedCardIndex === null || offer === null) return null;
  if (state.queuedCardIndex >= offer.cards.length) return null;
  return { offerId: offer.offerId, cardIndex: state.queuedCardIndex };
}

export function buildGameInput(options: GameInputBuildOptions): GameInput {
  const target = steerTargetFor(options);
  return {
    sequence: options.sequence,
    targetX: target.x,
    targetY: target.y,
    shouldSprint: options.state.isSprintQueued,
    traitChoice: traitChoiceFor(options.state, options.world.offer),
  };
}
