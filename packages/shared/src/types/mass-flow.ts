// Why the own cell's mass moves (docs/ui/hud.md §3.1.5, docs/architecture/wire-contract.md §4, #383): what the
// server's metabolism applied this tick, by cause, and what a sprint start took. The server reports the amounts it
// applied, so the client never keeps a second copy of the rules.

import type { ValueOf } from './common.js';
import type { PlayerProgressView, ZoneId } from './game.js';

/** The ongoing causes; the declaration order is the tie-break order of the rate tags. */
export const MASS_RATE_CAUSE = {
  /** Contact or aura: every other cell whose toxin reaches this one (docs/ecology/mass-and-movement.md §4.1). */
  toxin: 'toxin',
  /** The #154 dose of the prey this cell is engulfing: its toxin × `ENGULF_SWALLOWED_TOXIN_MULTIPLIER` + its spikes. */
  swallowed: 'swallowed',
  /** The broth share: `(m − CELL_STARTING_MASS) × MASS_DECAY_RATE_PER_SECOND × decayMultiplier`. */
  decay: 'decay',
  /** The vent's extra: the trait-scaled broth share × (`VENT_DECAY_MULTIPLIER` − 1). */
  vent: 'vent',
  /** Photosynthesis as applied, after the cap. */
  light: 'light',
} as const;
export type MassRateCause = ValueOf<typeof MASS_RATE_CAUSE>;
export const MASS_RATE_CAUSES: readonly MassRateCause[] = Object.values(MASS_RATE_CAUSE);

export interface MassFlowView {
  /**
   * Mass/s this tick's metabolism applied to the own cell (post-floor, post-cap); losses negative; a zero cause is
   * omitted. `SNAPSHOT_MASS_RATE_DECIMALS` on the wire.
   */
  ratesPerSecond: Partial<Record<MassRateCause, number>>;
  /** The owned traits' folded `decayMultiplier` − 1 (−0.15 with Mitochondrion I); omitted when 0. */
  decayTraitShare?: number;
  /** The zone the metabolism step used this tick: the zone pill, the zone beat and the VENT tag read this. */
  zone: ZoneId;
  /** Mass a sprint start took in this broadcast window, as applied (clipped at `CELL_STARTING_MASS`); omitted when none. */
  sprintSpent?: number;
}

/** `GameSnapshot.ownProgress`: the receiver's progress and why its cell's mass moves. */
export interface OwnProgressView extends PlayerProgressView {
  /** `null` while spectating, and until the metabolism step has run once for a new cell. */
  massFlow: MassFlowView | null;
}
