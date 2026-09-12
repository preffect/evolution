// The payout seam (docs/ECOLOGY.md §6.1, "Payout"). THIS IS THE ONE SEAM TICKET #259 FILLS.
//
// #258 shipped the lifecycle only: the engulf reaches progress 1 and ends here, and nothing is
// transferred. #259 replaces the body below with the payout table — mass yield to the predator
// (cap overflow → DNA), `ENGULF_DNA_BASE` + the prey's DNA share, the tag points, `absorptions`,
// the detritus, and the prey's death and respawn through `session/death.ts` `absorbCell`, which
// emits the `cell_absorbed` effect the renderer already consumes. Nothing else in the engulf step
// changes: `runEngulfs` calls this and only this on completion.
//
// Until then a completed engulf simply ends and, if the pair is still in contact and still
// eligible, starts again the next tick. That is the honest no-payout state, not a rule: no
// cooldown is invented here, because inventing one would be a balance decision #259 undoes.

import { clearEngulfRecords, type EngulfPairing } from './engulf-state.js';
import type { StepContext, WorldState } from '../world/world-state.js';

/**
 * A completed engulf. `world` and `context` are what #259 needs (effects, the spawner stream for
 * the detritus, the players) and what the call site already has.
 */
export function payOutEngulf(_world: WorldState, _context: StepContext, pairing: EngulfPairing): void {
  clearEngulfRecords(pairing);
}
