// The legibility cues' **state** constants (docs/ui/hud.md §3.1.6, the rows marked state): `state/` derives the
// record from them, so they live here rather than in `render/constants`. The doc owns the values;
// `render/legibility-cues-ledger.spec.ts` pins them.

export const MASS_TREND_WINDOW_SECONDS = 1;
export const MASS_TREND_ENTER_PER_SECOND = 0.2;
export const MASS_TREND_EXIT_PER_SECOND = 0.1;
export const RELATIONS_MAX_RINGED = 16;
