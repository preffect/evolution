// What a cell's stage and traits mean to the renderer (docs/VISUAL-STYLE.md §3–§4), read once per
// cell per frame and shared by the shape terms, the instance buffer and the organelle sprites.

import { CELL_STAGE, type CellView, type TraitId, type TraitTier } from '@evolution/shared';
import {
  CELL_WALL_SCALE_BY_TIER,
  CILIA_COUNT_BY_TIER,
  FILAMENT_COUNT_BY_TIER,
  FORM_WOBBLE_AMPLITUDE,
  FORM_WOBBLE_HZ,
  FORM_WOBBLE_MODE,
  HALO_KIND,
  PROTOCELL_WOBBLE_AMPLITUDE,
  PROTOCELL_WOBBLE_HZ,
  PROTOCELL_WOBBLE_MODE,
  RIBOSOME_DENSITY_BY_TIER,
  CHLOROPLAST,
} from '../constants';

export type HaloKind = (typeof HALO_KIND)[keyof typeof HALO_KIND];

export interface WobbleSpec {
  readonly mode: number;
  readonly amplitude: number;
  readonly hz: number;
}

export interface CellTraitSummary {
  readonly isProtocell: boolean;
  readonly isSpecialised: boolean;
  readonly hasNucleus: boolean;
  /** `cytoskeleton`: breathing and lobes halve, dents sharpen. */
  readonly isTaut: boolean;
  readonly haloKind: HaloKind;
  readonly ciliaCount: number;
  readonly wallScale: number;
  readonly speckleDensity: number;
  readonly filamentCount: number;
  /** Membrane tint toward `CHLORO_BASE`. */
  readonly tintMix: number;
  readonly wobble: WobbleSpec;
  readonly tierOf: (traitId: TraitId) => TraitTier | 0;
}

const NO_WOBBLE: WobbleSpec = { mode: 0, amplitude: 0, hz: 0 };
const PROTOCELL_WOBBLE: WobbleSpec = {
  mode: PROTOCELL_WOBBLE_MODE,
  amplitude: PROTOCELL_WOBBLE_AMPLITUDE,
  hz: PROTOCELL_WOBBLE_HZ,
};
const FORM_WOBBLE: WobbleSpec = { mode: FORM_WOBBLE_MODE, amplitude: FORM_WOBBLE_AMPLITUDE, hz: FORM_WOBBLE_HZ };

function tierTable(table: readonly number[], tier: TraitTier | 0): number {
  return tier === 0 ? 0 : (table[tier - 1] ?? 0);
}

function haloKindFor(isProtocell: boolean, hasTraitHalo: boolean): HaloKind {
  if (isProtocell) return HALO_KIND.protocell;
  return hasTraitHalo ? HALO_KIND.trait : HALO_KIND.default;
}

/** Folds `previewTraitId` in at tier I for rendering only when the cell does not own it (docs/RENDERING.md §3). */
export function summariseCellTraits(view: CellView, previewTraitId: TraitId | null = null): CellTraitSummary {
  const tiers = new Map<TraitId, TraitTier>(view.traits.map((owned) => [owned.traitId, owned.tier]));
  if (previewTraitId !== null && !tiers.has(previewTraitId)) tiers.set(previewTraitId, 1);
  const tierOf = (traitId: TraitId): TraitTier | 0 => tiers.get(traitId) ?? 0;
  const isProtocell = view.stage === CELL_STAGE.protocell;
  const isSpecialised = view.stage === CELL_STAGE.specialised;
  const hasTraitHalo = tierOf('chloroplast') > 0 || tierOf('toxin_vacuole') > 0;
  return {
    isProtocell,
    isSpecialised,
    hasNucleus: tierOf('nuclear_envelope') > 0,
    isTaut: tierOf('cytoskeleton') > 0,
    haloKind: haloKindFor(isProtocell, hasTraitHalo),
    ciliaCount: tierTable(CILIA_COUNT_BY_TIER, tierOf('cilia')),
    wallScale: tierTable(CELL_WALL_SCALE_BY_TIER, tierOf('cell_wall')),
    speckleDensity: tierTable(RIBOSOME_DENSITY_BY_TIER, tierOf('ribosomes')),
    filamentCount: tierTable(FILAMENT_COUNT_BY_TIER, tierOf('cytoskeleton')),
    tintMix: tierOf('chloroplast') > 0 ? CHLOROPLAST.membraneTint : 0,
    wobble: isProtocell ? PROTOCELL_WOBBLE : isSpecialised ? FORM_WOBBLE : NO_WOBBLE,
    tierOf,
  };
}
