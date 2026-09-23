// The HUD's type scale and its two font stacks (docs/visual-style/ui-type.md §7, which owns the values).
// It sits beside `colours.ts` because that doc owns both, and because the HUD and any world-space
// label the renderer grows must read the same table. Sizes are px at HUD scale 1; every stylesheet
// multiplies by `var(--ui-scale)` (docs/ui/layout.md §1).

/** Labels and body: a system stack, no web fonts and no font files (docs/visual-style/ui-type.md §7). */
export const UI_FONT_SANS = 'Inter, "Segoe UI", system-ui, sans-serif';
/** Numbers that change (mass, timer, DNA %): tabular digits do not jitter as they count. */
export const UI_FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Tracking on the `label` role: uppercase, 0.08 em (docs/visual-style/ui-type.md §7). */
export const UI_LABEL_TRACKING_EM = 0.08;

export interface UiTypeRole {
  readonly px: number;
  readonly font: string;
}

/**
 * The ten roles of docs/visual-style/ui-type.md §7. The HUD names a role, never a px size: a role is a
 * size **and** a face together, and half of one borrowed against half of another is how a type
 * scale stops being a scale. `caption` never carries a fact, and `label` at 12 px is the floor.
 */
export const UI_TYPE = {
  number: { px: 28, font: UI_FONT_MONO },
  headline: { px: 26, font: UI_FONT_SANS },
  clock: { px: 24, font: UI_FONT_MONO },
  title: { px: 22, font: UI_FONT_SANS },
  value: { px: 20, font: UI_FONT_MONO },
  cardName: { px: 16, font: UI_FONT_SANS },
  body: { px: 14, font: UI_FONT_SANS },
  /** `body`'s size in the mono face: a changing number inside a dense row, at body weight. */
  figure: { px: 14, font: UI_FONT_MONO },
  label: { px: 12, font: UI_FONT_SANS },
  caption: { px: 11, font: UI_FONT_SANS },
} as const satisfies Readonly<Record<string, UiTypeRole>>;
