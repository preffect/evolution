// Input coalescing (docs/ARCHITECTURE.md §3.2): between two ticks the newest `sequence` and
// target win, the one-shots (`shouldSprint`, `traitChoice`) are OR-merged so a pick or a sprint
// that arrives together with a newer target is never lost. Applied at step 1 (inputs.ts).

import type { GameInput, PlayerId } from '@evolution/shared';
import { findPlayer } from '../world/lookups.js';
import type { InputRejectionCounters, WorldState } from '../world/world-state.js';

/** Merges `incoming` over `pending`; the caller has already checked that `incoming` is newer. */
export function coalesceInput(pending: GameInput | null, incoming: GameInput): GameInput {
  if (pending === null) {
    return incoming;
  }
  return {
    ...incoming,
    shouldSprint: pending.shouldSprint || incoming.shouldSprint,
    traitChoice: incoming.traitChoice ?? pending.traitChoice,
  };
}

/** An input is stale when its sequence is not newer than the last applied one and the pending one. */
export function isStaleInput(incoming: GameInput, appliedSequence: number, pending: GameInput | null): boolean {
  return incoming.sequence <= appliedSequence || (pending !== null && incoming.sequence <= pending.sequence);
}

/**
 * The module's `submitInput` (and the replay runner's, one code path): an unknown player is
 * ignored, a stale sequence is dropped and counted, the rest coalesces into the pending slot.
 * Returns whether the input was accepted.
 */
export function submitPlayerInput(
  world: WorldState,
  playerId: PlayerId,
  input: GameInput,
  rejections: InputRejectionCounters,
): boolean {
  const player = findPlayer(world, playerId);
  if (player === undefined) {
    return false;
  }
  if (isStaleInput(input, player.appliedInputSequence, player.pendingInput)) {
    rejections.staleSequence += 1;
    return false;
  }
  player.pendingInput = coalesceInput(player.pendingInput, input);
  return true;
}
