// A starving wild cell's look (docs/ecology/wild-cells.md §3.3.6, visual-style/motion-and-legibility.md §5 "Starving";
// ticket #557 question 2 = A, #635): it fades and shrivels on its way to the burst. Sizes are fractions of `r`.

/**
 * Its `wither` is lerp(`STARVING_WITHER_ONSET`, 1, `starvedOutMass / mass`) (`cells/starving-wither.ts`): the onset is the
 * floor an infinitely heavy starver would start at, and since a starver is at most `1 / WILD_CELL_SIZE_FACTOR_MIN`
 * times its burst mass, a typical one starts at about 0.5 (never below ≈ 0.475) and reaches 1 at the burst. At full wither its palette
 * shades are `STARVING_DESATURATION` of the way to their own grey, sallowed `STARVING_SALLOW_SHARE` toward
 * `STARVING_SALLOW` and dimmed to `STARVING_DULL_VALUE`; its rim light dims by `STARVING_RIM_DIM`, the whole cell fades
 * by `STARVING_FADE`, its glint dims by `STARVING_GLINT_DIM`, its organelle sprites are tinted `STARVING_ORGANELLE_SALLOW_SHARE` toward the sallow, and its
 * outline crinkles: a second octave of the strip jitter, `STARVING_WRINKLE_OCTAVE` times as fine, of amplitude
 * `STARVING_WRINKLE_AMPLITUDE`. Every term scales linearly with `wither`, so the cell dies by degrees as it shrinks.
 */
export const STARVING_WITHER_ONSET = 0.3;
export const STARVING_DESATURATION = 0.85;
export const STARVING_SALLOW_SHARE = 0.35;
export const STARVING_DULL_VALUE = 0.78;
export const STARVING_RIM_DIM = 0.45;
export const STARVING_FADE = 0.25;
export const STARVING_GLINT_DIM = 0.8;
export const STARVING_ORGANELLE_SALLOW_SHARE = 0.6;
export const STARVING_WRINKLE_AMPLITUDE = 0.045;
/** Integer, so the finer octave still closes round the ring: 24 jitter knots × 3 = a crinkle every 5 °. */
export const STARVING_WRINKLE_OCTAVE = 3;
/** Rec. 709 luma weights: the grey a shade desaturates to keeps its lightness. */
export const LUMA_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
