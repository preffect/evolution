// The latch, the archaeon's arms (docs/game-design/early-life.md §15.4, its constants table §15.12.1): the `earlyLife`
// balance domain. Who latches is `bacteriumContactOutcome` (simulation/bacterium-contact.ts): a player cell that has
// reached `LATCH_FROM_STAGE` and not the swallow switch (`SWALLOW_FROM_STAGE`, the `absorption` domain).

import { CELL_STAGE, type CellStage } from '../types/game.js';

/** A player cell latches bacteria from this stage on, until it reaches `SWALLOW_FROM_STAGE`. Patchable to any stage. */
export const LATCH_FROM_STAGE: CellStage = CELL_STAGE.prokaryote;
/** A bacterium latches when its centre lies within `radius × (1 + this)` of the cell's centre (own radii past the rim). */
export const LATCH_REACH_RADII = 0.25;
/** A cell holds at most this many bacteria (one cluster); a bacterium past the cap passes under it. */
export const LATCH_MAX_HELD = 5;
/** A bacterium held this long (s) bonds: it is eaten through the eating step and leaves the held list. */
export const LATCH_BOND_SECONDS = 6;
