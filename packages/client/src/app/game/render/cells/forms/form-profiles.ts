// `B(Δ)` per form (docs/RENDERING.md §2.4). #99 ships the blob (B ≡ 1); the five specialised
// silhouettes register here with #121. Every profile is normalised to unit area (`∫ B² dΔ = 2π`)
// so a form's drawn area equals the blob's `π r²` and mass ∝ area holds (form-profiles.spec.ts).

import { RADIANS_PER_FULL_TURN, type TraitId } from '@evolution/shared';
import type { FormProfile } from '../radial-profile';

export const FORM_ID = { blob: 0 } as const;
export type FormId = (typeof FORM_ID)[keyof typeof FORM_ID];

export interface FormDefinition {
  readonly id: FormId;
  readonly profile: FormProfile | null;
}

/** The generic blob: `B ≡ 1`, so the profile term is absent and the shader skips it. */
export const BLOB_FORM: FormDefinition = { id: FORM_ID.blob, profile: null };

/** Keyed by the form trait; a stage-five trait with no row draws the blob. */
export const FORM_PROFILES: Readonly<Partial<Record<TraitId, FormDefinition>>> = {};

export function formFor(formTraitId: TraitId | null): FormDefinition {
  return (formTraitId !== null && FORM_PROFILES[formTraitId]) || BLOB_FORM;
}

const AREA_SAMPLES = 720;

/** `∫ B² dΔ / 2π`: exactly 1 for a unit-area form. */
export function normalisedArea(profile: FormProfile | null): number {
  if (profile === null) return 1;
  let sum = 0;
  for (let index = 0; index < AREA_SAMPLES; index += 1) {
    const value = profile.evaluate((index / AREA_SAMPLES) * RADIANS_PER_FULL_TURN - Math.PI).value;
    sum += value * value;
  }
  return sum / AREA_SAMPLES;
}
