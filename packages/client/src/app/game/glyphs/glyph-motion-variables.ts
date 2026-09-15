// The one bridge between the glyph's motion constants and its keyframes (docs/visual-style/ui-type.md §7.1), the way
// `hud/format/hud-css-variables.ts` bridges the HUD's: a stylesheet cannot interpolate a TypeScript constant, so the
// glyph component publishes the amplitudes as custom properties on its host and every `@keyframes` step reads
// `var(--glyph-…)`. Pure; `glyph-motion-variables.spec.ts` pins the set entry by entry and the pulse ceiling.

import { GLYPH_MOTION_AMPLITUDE } from '../render/constants/trait-glyph-layers';

export type GlyphMotionVariables = Readonly<Record<string, string>>;

/** The `--glyph-…` custom properties the idle keyframes read, with their units. */
export function glyphMotionVariables(): GlyphMotionVariables {
  return {
    '--glyph-breathe-scale': String(GLYPH_MOTION_AMPLITUDE.breatheScale),
    '--glyph-beat-scale': String(GLYPH_MOTION_AMPLITUDE.beatScale),
    '--glyph-sway-angle': `${GLYPH_MOTION_AMPLITUDE.swayDeg}deg`,
    '--glyph-rise-distance': `${GLYPH_MOTION_AMPLITUDE.riseUnits}px`,
  };
}
