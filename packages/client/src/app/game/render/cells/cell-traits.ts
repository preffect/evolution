// What a cell's stage and traits mean to the generic blob (docs/VISUAL-STYLE.md §3): whether it is
// a protocell (the emptier stack, the mode-2 wobble), whether the nucleoid has gathered into a
// nucleus, which halo it wears and what tier of each trait it owns (the organelle counts). Read
// once per cell per frame and shared by the shape terms, the instance builder and the organelle
// layout. The trait tells (cilia, wall, speckle, filaments, trait halos, forms) join with #216.

import { CELL_STAGE, type CellView, type TraitId, type TraitTier } from '@evolution/shared';
import { HALO_KIND, PROTOCELL_WOBBLE_AMPLITUDE, PROTOCELL_WOBBLE_HZ, PROTOCELL_WOBBLE_MODE } from '../constants';

export type HaloKind = (typeof HALO_KIND)[keyof typeof HALO_KIND];

export interface WobbleSpec {
  readonly mode: number;
  /** Fraction of `r`. */
  readonly amplitude: number;
  readonly hz: number;
}

export interface CellTraitSummary {
  readonly isProtocell: boolean;
  /** `nuclear_envelope` owned: the nucleoid has gathered into the nucleus sprite. */
  readonly hasNucleus: boolean;
  readonly haloKind: HaloKind;
  readonly wobble: WobbleSpec;
  readonly tierOf: (traitId: TraitId) => TraitTier | 0;
}

const NUCLEUS_TRAIT: TraitId = 'nuclear_envelope';
const PREVIEW_TIER: TraitTier = 1;
const NO_WOBBLE: WobbleSpec = { mode: 0, amplitude: 0, hz: 0 };
const PROTOCELL_WOBBLE: WobbleSpec = {
  mode: PROTOCELL_WOBBLE_MODE,
  amplitude: PROTOCELL_WOBBLE_AMPLITUDE,
  hz: PROTOCELL_WOBBLE_HZ,
};

/** Folds `previewTraitId` in at tier I for rendering only when the cell does not own it (docs/RENDERING.md §3). */
export function summariseCellTraits(view: CellView, previewTraitId: TraitId | null = null): CellTraitSummary {
  const tiers = new Map<TraitId, TraitTier>(view.traits.map((owned) => [owned.traitId, owned.tier]));
  if (previewTraitId !== null && !tiers.has(previewTraitId)) tiers.set(previewTraitId, PREVIEW_TIER);
  const tierOf = (traitId: TraitId): TraitTier | 0 => tiers.get(traitId) ?? 0;
  const isProtocell = view.stage === CELL_STAGE.protocell;
  return {
    isProtocell,
    hasNucleus: tierOf(NUCLEUS_TRAIT) > 0,
    haloKind: isProtocell ? HALO_KIND.protocell : HALO_KIND.default,
    wobble: isProtocell ? PROTOCELL_WOBBLE : NO_WOBBLE,
    tierOf,
  };
}
