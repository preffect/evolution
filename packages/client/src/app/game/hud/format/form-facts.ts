// The one real-life line each form's popup teaches (docs/ui/overlays.md §3.8, #783): the five rung-5 forms only, a
// fact about the organism the form is named after, short and in the coach pill's style (no full stop). Each was checked
// against a reference text on protists before it went in; a line is a claim a curious player may look up. Ordinary
// traits have none. Pure data.

import { CELL_STAGE, STAGE_GATE_TRAITS, type TraitId } from '@evolution/shared';

/** The rung whose gates are the forms: gaining one is the form popup's moment, and its stage toast gives way to it. */
export const FORM_STAGE = CELL_STAGE.specialised;

/** The form traits, in the ladder's order. */
export const FORM_TRAIT_IDS: readonly TraitId[] = STAGE_GATE_TRAITS[FORM_STAGE];

export interface FormRealLifeLine {
  readonly traitId: TraitId;
  readonly line: string;
}

/** One row per form; the spec pins the ids to `FORM_TRAIT_IDS` exactly. */
export const FORM_REAL_LIFE_LINES: readonly FormRealLifeLine[] = [
  { traitId: 'amoeba_pseudopods', line: 'Real amoebae crawl and engulf food with pseudopods' },
  { traitId: 'paramecium_cilia', line: 'Real paramecia swim with thousands of beating cilia' },
  { traitId: 'euglena_eyespot', line: 'Real euglenas use a red eyespot to swim toward light' },
  { traitId: 'diatom_shell', line: 'Real diatoms live in glass shells made of silica' },
  { traitId: 'stentor_trumpet', line: 'Real stentors can regrow a whole cell from a small piece' },
];

export function isFormTrait(traitId: TraitId): boolean {
  return FORM_TRAIT_IDS.includes(traitId);
}

/** `traitId`'s real-life line; `null` for a trait that is not a form. */
export function formRealLifeLine(traitId: TraitId): string | null {
  return FORM_REAL_LIFE_LINES.find((row) => row.traitId === traitId)?.line ?? null;
}
