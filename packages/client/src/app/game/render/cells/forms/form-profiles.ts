// `B(Δ)` per form (docs/rendering/cells.md §2.4): the registry keyed by the form trait, the sheet-04
// aspects each silhouette is drawn to, and the unit-area rule every profile obeys
// (`∫ B² dΔ = 2π`, so the drawn area equals the blob's `π r²` and mass ∝ area holds for forms as
// for the blob). #216 ships the registry with the blob (`B ≡ 1`) and the aspects; the five
// silhouettes register their `profile` with #192–#196. Appendages (the amoeba's pseudopods, `amoeba-pseudopods.ts`;
// the paramecium's cilia tufts, `paramecium-cilia.ts`; the euglena's flagellum, `euglena-flagellum.ts`) are not body
// and sit outside the rule
// (visual-style/motion-and-legibility.md §5.1, #646).

import { tierEntryOf, type TraitId, type TraitTier } from '@evolution/shared';
import {
  DIATOM_ASPECT,
  FORM_ID,
  PSEUDOPOD_COUNT_BY_TIER,
  SLIPPER_ASPECT_BY_TIER,
  SPINDLE_ASPECT,
  TRUMPET_MOUTH_TO_HEIGHT,
} from '../../constants';
import type { FormProfile } from '../radial-profile';
import { AMOEBA_CORE_PROFILE } from './amoeba-pseudopods';
import { slipperProfileAt } from './slipper-profile';
import { SPINDLE_PROFILE } from './spindle-profile';
import { meanSquareRadius } from './unit-area';

export type FormId = (typeof FORM_ID)[keyof typeof FORM_ID];

export interface FormDefinition {
  readonly id: FormId;
  /** The sheet-04 aspect (length : width, or mouth : height for the trumpet) at `tier`; 1 for a circle. */
  readonly aspectAt: (tier: TraitTier) => number;
  /** `B(Δ)` at `tier`; `null` draws the blob (the silhouettes join with #192–#196). */
  readonly profileAt: (tier: TraitTier) => FormProfile | null;
  /** A rigid valve: wobble, jitter, lobes and breathing are zero (§2.4 diatom). */
  readonly isRigid: boolean;
}

const BLOB_PROFILE = (): FormProfile | null => null;
const CIRCLE = (): number => DIATOM_ASPECT;
/** The slipper past its table falls back to its tier-I aspect. */
const [SLIPPER_TIER_I_ASPECT] = SLIPPER_ASPECT_BY_TIER;

/** The generic blob: `B ≡ 1`, so the profile term is absent and the shader skips it. */
export const BLOB_FORM: FormDefinition = {
  id: FORM_ID.blob,
  aspectAt: CIRCLE,
  profileAt: BLOB_PROFILE,
  isRigid: false,
};

/** Keyed by the form trait (visual-style/cells-and-organelles.md §4); a stage-five trait with no row draws the blob. */
export const FORM_PROFILES: ReadonlyMap<TraitId, FormDefinition> = new Map<TraitId, FormDefinition>([
  [
    'paramecium_cilia',
    {
      id: FORM_ID.slipper,
      aspectAt: (tier) => tierEntryOf(SLIPPER_ASPECT_BY_TIER, tier) ?? SLIPPER_TIER_I_ASPECT,
      profileAt: slipperProfileAt,
      isRigid: false,
    },
  ],
  [
    'euglena_eyespot',
    { id: FORM_ID.spindle, aspectAt: () => SPINDLE_ASPECT, profileAt: () => SPINDLE_PROFILE, isRigid: false },
  ],
  [
    'stentor_trumpet',
    { id: FORM_ID.trumpet, aspectAt: () => TRUMPET_MOUTH_TO_HEIGHT, profileAt: BLOB_PROFILE, isRigid: false },
  ],
  ['diatom_shell', { id: FORM_ID.diatom, aspectAt: CIRCLE, profileAt: BLOB_PROFILE, isRigid: true }],
  ['amoeba_pseudopods', { id: FORM_ID.amoeba, aspectAt: CIRCLE, profileAt: () => AMOEBA_CORE_PROFILE, isRigid: false }],
]);

/** The form trait a cell owns, if any: the first registered trait in its list. */
export function formTraitOf(traits: readonly { readonly traitId: TraitId }[]): TraitId | null {
  return traits.find((owned) => FORM_PROFILES.has(owned.traitId))?.traitId ?? null;
}

export function formFor(formTraitId: TraitId | null): FormDefinition {
  return (formTraitId !== null && FORM_PROFILES.get(formTraitId)) || BLOB_FORM;
}

/** Pseudopod lobes at `tier` (sheet 04 amoeba); 0 for every other form. */
export function pseudopodCount(form: FormDefinition, tier: TraitTier): number {
  return form.id === FORM_ID.amoeba ? (tierEntryOf(PSEUDOPOD_COUNT_BY_TIER, tier) ?? 0) : 0;
}

/** `∫ B² dΔ / 2π`: exactly 1 for a unit-area form. */
export function normalisedArea(profile: FormProfile | null): number {
  return profile === null ? 1 : meanSquareRadius((delta) => profile.evaluate(delta).value);
}
