// The one adapter between the client model and the input layer (docs/ARCHITECTURE.md §5): reads
// `WorldStore` and answers what one client tick needs — the own cell, the open offer and the live
// steer tunables. `null` means "nothing to steer": before the first `game_state`, and through the
// results phase, where the server ignores input anyway (docs/GAME-DESIGN.md §5.4).

import { ROUND_PHASE } from '@evolution/shared';
import type { WorldStore } from '../net/world-store';
import type { InputWorldContext } from './game-input-builder';

/**
 * **Invariant the trait-pick retry depends on: the offer and the applied sequence come from one
 * snapshot.** `trait-pick.ts` compares them against each other, so they have to describe the same
 * moment of the server's world; read from two snapshots they could say "answered past my send"
 * and "the offer is still open" about different ticks, and a pick that landed would be resent.
 * The server half of the same invariant is `applyPlayerInput` (`game/simulation/inputs.ts`).
 * Pinned by `input-world-context.spec.ts` ("pairs the offer with the applied sequence of the same
 * snapshot").
 */
export function inputWorldContextOf(store: WorldStore): InputWorldContext | null {
  const snapshot = store.latestSnapshot();
  const balance = store.balance;
  const ownPlayerId = store.ownPlayerId;
  if (snapshot === null || balance === null || ownPlayerId === null) return null;
  if (snapshot.roundPhase !== ROUND_PHASE.playing) return null;
  const ownCell = snapshot.cells.find((cell) => cell.playerId === ownPlayerId) ?? null;
  return {
    ownCell: ownCell === null ? null : { x: ownCell.x, y: ownCell.y, radiusWu: ownCell.radius },
    offer: snapshot.players[ownPlayerId]?.offer ?? null,
    controls: balance.controls,
    appliedInputSequence: snapshot.appliedInputSequenceByPlayer[ownPlayerId] ?? 0,
  };
}
