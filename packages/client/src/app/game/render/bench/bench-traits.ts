// The trait sets the bench scene gives each stage (docs/VISUAL-STYLE.md §3): every tier of every
// organelle the ladder through eukaryote shows, so the atlas, the shader bands and the sprites
// are all exercised. The specialised row wears the amoeba trait and draws the blob until #121.

import { CELL_STAGE, STAGE_ORDER, type CellStage, type OwnedTrait } from '@evolution/shared';

const TIER_I = 1;
const TIER_II = 2;
const TIER_III = 3;

export const BENCH_STAGE_TRAITS: Readonly<Record<CellStage, readonly OwnedTrait[]>> = {
  [CELL_STAGE.protocell]: [],
  [CELL_STAGE.prokaryote]: [
    { traitId: 'nucleoid', tier: TIER_II },
    { traitId: 'simple_flagellum', tier: TIER_II },
    { traitId: 'cell_wall', tier: TIER_I },
    { traitId: 'ribosomes', tier: TIER_II },
  ],
  [CELL_STAGE.endosymbiosis]: [
    { traitId: 'nucleoid', tier: TIER_III },
    { traitId: 'ribosomes', tier: TIER_III },
    { traitId: 'mitochondrion', tier: TIER_II },
    { traitId: 'chloroplast', tier: TIER_I },
  ],
  [CELL_STAGE.eukaryote]: [
    { traitId: 'nucleoid', tier: TIER_III },
    { traitId: 'mitochondrion', tier: TIER_III },
    { traitId: 'nuclear_envelope', tier: TIER_II },
    { traitId: 'cytoskeleton', tier: TIER_I },
    { traitId: 'cilia', tier: TIER_II },
    { traitId: 'food_vacuole', tier: TIER_II },
    { traitId: 'toxin_vacuole', tier: TIER_I },
  ],
  [CELL_STAGE.specialised]: [
    { traitId: 'nucleoid', tier: TIER_III },
    { traitId: 'mitochondrion', tier: TIER_III },
    { traitId: 'nuclear_envelope', tier: TIER_III },
    { traitId: 'cytoskeleton', tier: TIER_III },
    { traitId: 'amoeba_pseudopods', tier: TIER_I },
  ],
};

/** Stages cycle in ladder order so every bench palette wears every stage. */
export function benchCellStage(index: number): CellStage {
  return STAGE_ORDER[index % STAGE_ORDER.length] ?? CELL_STAGE.protocell;
}
