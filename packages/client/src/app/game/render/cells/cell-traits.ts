// What a cell's stage and traits mean to the generic blob (docs/VISUAL-STYLE.md §3–§4): whether it
// is a protocell (the emptier stack, the mode-2 wobble) or a specialised form (mode-3), whether the
// nucleoid has gathered into a nucleus, which halo it wears, the tier of each trait (the organelle
// counts) and the shader tells: cilia hairs, wall thickness, ribosome speckle, cytoskeleton
// filaments, the chloroplast tint and the form. Read once per cell per frame and shared by the
// shape terms, the instance builder and the organelle layout.

import { CELL_STAGE, type CellView, type TraitId, type TraitTier } from '@evolution/shared';
import {
  CELL_WALL_SCALE_BY_TIER,
  CHLOROPLAST,
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
} from '../constants';
import { BLOB_FORM, formFor, formTraitOf, type FormDefinition } from './forms/form-profiles';

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
  /** `cytoskeleton` owned: breathing and lobes halve, the contact dent sharpens (VISUAL-STYLE §5). */
  readonly isTaut: boolean;
  readonly haloKind: HaloKind;
  readonly wobble: WobbleSpec;
  /** The pass-B hairs (0 without `cilia`), the wall thickness scale (0 without `cell_wall`). */
  readonly ciliaCount: number;
  readonly wallScale: number;
  /** The pass-A dot count in the speckle band and the filament count from the nucleus. */
  readonly speckleDensity: number;
  readonly filamentCount: number;
  /** The membrane's mix toward `CHLORO_BASE` with `chloroplast`. */
  readonly tintMix: number;
  readonly form: FormDefinition;
  readonly formTier: TraitTier;
  readonly tierOf: (traitId: TraitId) => TraitTier | 0;
}

const NUCLEUS_TRAIT: TraitId = 'nuclear_envelope';
const TAUT_TRAIT: TraitId = 'cytoskeleton';
const CHLOROPLAST_TRAIT: TraitId = 'chloroplast';
const TOXIN_TRAIT: TraitId = 'toxin_vacuole';
const CILIA_TRAIT: TraitId = 'cilia';
const WALL_TRAIT: TraitId = 'cell_wall';
const RIBOSOME_TRAIT: TraitId = 'ribosomes';
const PREVIEW_TIER: TraitTier = 1;
const NO_WOBBLE: WobbleSpec = { mode: 0, amplitude: 0, hz: 0 };
const PROTOCELL_WOBBLE: WobbleSpec = {
  mode: PROTOCELL_WOBBLE_MODE,
  amplitude: PROTOCELL_WOBBLE_AMPLITUDE,
  hz: PROTOCELL_WOBBLE_HZ,
};
const FORM_WOBBLE: WobbleSpec = { mode: FORM_WOBBLE_MODE, amplitude: FORM_WOBBLE_AMPLITUDE, hz: FORM_WOBBLE_HZ };

type TierOf = (traitId: TraitId) => TraitTier | 0;

/** `table[tier − 1]`, 0 when the trait is not owned. */
function tierTable(table: readonly number[], tier: TraitTier | 0): number {
  return tier === 0 ? 0 : (table[tier - 1] ?? 0);
}

/** One glow per body (VISUAL-STYLE §1, sheet 01): the chloroplast halo wins over the toxin one. */
function haloKindFor(isProtocell: boolean, tierOf: TierOf): HaloKind {
  if (isProtocell) return HALO_KIND.protocell;
  if (tierOf(CHLOROPLAST_TRAIT) > 0) return HALO_KIND.chloroplast;
  return tierOf(TOXIN_TRAIT) > 0 ? HALO_KIND.toxin : HALO_KIND.default;
}

/** Protocells wobble on mode 2; forms hold a mode-3 shape unless rigid; a diatom and the blob rest still. */
function wobbleFor(isProtocell: boolean, form: FormDefinition): WobbleSpec {
  if (isProtocell) return PROTOCELL_WOBBLE;
  return form === BLOB_FORM || form.isRigid ? NO_WOBBLE : FORM_WOBBLE;
}

/** Folds `previewTraitId` in at tier I for rendering only when the cell does not own it (docs/RENDERING.md §3). */
export function summariseCellTraits(view: CellView, previewTraitId: TraitId | null = null): CellTraitSummary {
  const tiers = new Map<TraitId, TraitTier>(view.traits.map((owned) => [owned.traitId, owned.tier]));
  if (previewTraitId !== null && !tiers.has(previewTraitId)) tiers.set(previewTraitId, PREVIEW_TIER);
  const tierOf: TierOf = (traitId) => tiers.get(traitId) ?? 0;
  const isProtocell = view.stage === CELL_STAGE.protocell;
  const formTraitId = formTraitOf([...tiers.keys()].map((traitId) => ({ traitId })));
  const form = formFor(formTraitId);
  const formTier = formTraitId === null ? PREVIEW_TIER : (tiers.get(formTraitId) ?? PREVIEW_TIER);
  return {
    isProtocell,
    hasNucleus: tierOf(NUCLEUS_TRAIT) > 0,
    isTaut: tierOf(TAUT_TRAIT) > 0,
    haloKind: haloKindFor(isProtocell, tierOf),
    wobble: wobbleFor(isProtocell, form),
    ciliaCount: tierTable(CILIA_COUNT_BY_TIER, tierOf(CILIA_TRAIT)),
    wallScale: tierTable(CELL_WALL_SCALE_BY_TIER, tierOf(WALL_TRAIT)),
    speckleDensity: tierTable(RIBOSOME_DENSITY_BY_TIER, tierOf(RIBOSOME_TRAIT)),
    filamentCount: tierTable(FILAMENT_COUNT_BY_TIER, tierOf(TAUT_TRAIT)),
    tintMix: tierOf(CHLOROPLAST_TRAIT) > 0 ? CHLOROPLAST.membraneTint : 0,
    form,
    formTier,
    tierOf,
  };
}
