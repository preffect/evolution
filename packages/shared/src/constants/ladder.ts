// The evolution ladder (docs/GAME-DESIGN.md §3, §12). `CELL_STAGE` (types/game.ts) names the
// stages; this file fixes their order and their gates.

import { CELL_STAGE, type CellStage, type TraitId } from '../types/game.js';

/** The five stages in climb order; `STARTING_STAGE` is the first. */
export const STAGE_ORDER = [
  CELL_STAGE.protocell,
  CELL_STAGE.prokaryote,
  CELL_STAGE.endosymbiosis,
  CELL_STAGE.eukaryote,
  CELL_STAGE.specialised,
] as const satisfies readonly CellStage[];

export const STARTING_STAGE: CellStage = STAGE_ORDER[0];

/** Owning any listed trait (any tier) reaches the stage; the starting stage has no gate. */
export const STAGE_GATE_TRAITS: Record<CellStage, readonly TraitId[]> = {
  protocell: [],
  prokaryote: ['nucleoid'],
  endosymbiosis: ['mitochondrion', 'chloroplast'],
  eukaryote: ['nuclear_envelope'],
  specialised: ['amoeba_pseudopods', 'paramecium_cilia', 'euglena_eyespot', 'diatom_shell', 'stentor_trumpet'],
};

/** Bacteria of one variant eaten to unlock its endosymbiont: two full clusters (docs/ECOLOGY.md §1, decision #138). */
export const ENDOSYMBIOSIS_BACTERIA_REQUIRED = 10;
