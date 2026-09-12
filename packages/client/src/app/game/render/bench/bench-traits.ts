// The trait sets the bench scene gives each stage (docs/VISUAL-STYLE.md §3) and the player
// records behind the player cells: every tier of every organelle the ladder through eukaryote
// shows, so the atlas, the shader tells and the sprites are all exercised; the specialised row
// wears the amoeba form. The player records climb the DNA bar with the tick.

import {
  CELL_STAGE,
  PLAYER_LIFE_STATE,
  PLAYER_PALETTE_COUNT,
  STAGE_ORDER,
  zeroRecord,
  BACTERIUM_VARIANTS,
  DNA_TAGS,
  type CellStage,
  type OwnedTrait,
  type PlayerId,
  type PlayerProgressView,
  type TraitTier,
} from '@evolution/shared';
import { RENDER_BENCH_LEVEL_UP_EVERY_TICKS } from '../constants';

const TIER_I: TraitTier = 1;
const TIER_II: TraitTier = 2;
const TIER_III: TraitTier = 3;

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

/** The level a bench cell of `index` reports: one per palette, so the level pip shows every value. */
export function benchCellLevel(index: number): number {
  return 1 + (index % PLAYER_PALETTE_COUNT);
}

export interface BenchPlayerSpec {
  readonly index: number;
  readonly playerId: PlayerId;
}

/** One alive record per player cell; the DNA bar climbs and wraps on the level-up cadence. */
export function benchPlayers(players: readonly BenchPlayerSpec[], tick: number): Record<string, PlayerProgressView> {
  const records: Record<string, PlayerProgressView> = {};
  for (const player of players) {
    records[player.playerId] = {
      playerId: player.playerId,
      playerName: `Bench ${player.index}`,
      level: benchCellLevel(player.index),
      dnaCumulative: tick,
      dnaCatchUpGift: 0,
      dnaTowardNextLevel: tick % RENDER_BENCH_LEVEL_UP_EVERY_TICKS,
      dnaTagPoints: zeroRecord(DNA_TAGS),
      bacteriaEatenByVariant: zeroRecord(BACTERIUM_VARIANTS),
      absorptions: 0,
      wildAbsorptions: 0,
      score: player.index,
      offer: null,
      lifeState: PLAYER_LIFE_STATE.alive,
      spectatingCellId: null,
      respawnInTicks: 0,
    };
  }
  return records;
}
