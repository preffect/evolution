// The opening dive's diatoms (docs/rendering/opening-dive.md §4, ticket #803): the mockup's glass (`rimGrad`,
// `bodyGrad`, `glint`, `lw`), `lanceolate`, `pennate`, `cocconeis`, `licmophora` and `diatomSprite` numbers under its
// own names. A diatom's numbers are in its own unit: its length is 1. Kept out of the `render/constants` barrel: only
// the dive's lazily loaded slime chunk reads it.

/** The thinnest line the mockup strokes, in css px (`lw`), and a glint's least radius in css px. */
export const SLIME_LINE_MIN_PX = 1.1;

/** Game-style glass (`rimGrad`, `bodyGrad`, `glint`): a lit rim, a translucent body lit from the top-left, a glint. */
export const SLIME_GLASS = {
  rim: { stops: [0, 0.35, 0.72, 1] },
  body: { lightX: -0.35, lightY: -0.38, core: 0.05, farX: 0.1, farY: 0.1, reach: 1.1, stop: 0.55, darkAlpha: 0.9 },
  glint: { stops: [0, 0.3, 1], alphas: [0.95, 0.5, 0] },
} as const;

/** A boat-shaped diatom's outline (`lanceolate`): `points` points a side, `W / 2 × (1 − u²)^power` wide. */
export const SLIME_LANCEOLATE = { points: 28, power: 0.62 } as const;

/** The diatoms' own browns between the game's plastid light and dark (`bodyGrad`'s middle stops). */
export const SLIME_DIATOM_BROWN = { pennate: '#b98a2e', other: '#a87a28' } as const;

/**
 * A pennate diatom (`pennate`): a glass box `width` wide scored with striae `striaSpacing` apart (from `striaeAbovePx`
 * px between them), two plastids from `plastidsAbovePx`, the raphe from `rapheAbovePx`, a glint from `glintAbovePx`.
 * Each alpha is `base + darkField × df`.
 */
export const SLIME_PENNATE = {
  hideBelowPx: 3,
  width: 0.2,
  halo: { radius: 0.62, base: 0.16, darkField: 0.26 },
  fill: { base: 0.14, darkField: 0.1 },
  plastids: { abovePx: 12, offset: 0.2, radiusX: 0.36, radiusY: 0.17, lightRadius: 0.3, alpha: 0.85 },
  striae: { spacing: 1 / 60, half: 30, skipWithin: 2, abovePx: 2.6, width: 0.3, base: 0.26, darkField: 0.22 },
  raphe: { abovePx: 16, from: 0.04, to: 0.44, width: 0.006, alpha: 0.7, node: { radiusX: 0.03, radiusY: 0.12 } },
  nodeAlpha: 0.5,
  rimWidth: 0.012,
  glint: { abovePx: 20, x: -0.3, y: -0.22, minPx: 3, radius: 0.03 },
} as const;

/** Cocconeis (`cocconeis`): a flat oval pressed onto the kelp, rayed and with its raphe from `detailAbovePx`. */
export const SLIME_COCCONEIS = {
  hideBelowPx: 3,
  radiusX: 0.5,
  radiusY: 0.33,
  halo: { radius: 0.7, base: 0.14, darkField: 0.26 },
  body: { base: 0.5, bright: 0.15 },
  detailAbovePx: 14,
  rays: { count: 36, innerX: 0.1, innerY: 0.05, width: 0.008, alpha: 0.3 },
  raphe: { half: 0.3, width: 0.01, alpha: 0.6 },
  rimWidth: 0.02,
  glint: { abovePx: 20, x: -0.22, y: -0.14, minPx: 2.5, radius: 0.04 },
} as const;

/** Licmophora (`licmophora`): five wedges fanned on a mucilage stalk, swaying slowly. */
export const SLIME_LICMOPHORA = {
  hideBelowPx: 4,
  sway: { rate: 0.7, phasePerMetre: 1e5, amount: 0.05 },
  stalk: { length: 0.45, width: 0.03, alpha: 0.35 },
  wedges: { count: 5, spread: 0.22, root: 0.02, tip: 0.09, bulge: 1.04, alpha: 0.55 },
  rimWidth: 0.012,
} as const;

/**
 * A small diatom in bright field (`diatomSprite`): its halo, body and rim on a `sizePx` sprite `span` lengths across,
 * drawn as the diatom looks `detailPx` long (its rim a 1.1 px line on a 10 px diatom, no striae or glint); laid while
 * the dark field has not begun and the diatom is under `spriteBelowPx` long (per kind), and not under `hideBelowPx`.
 */
export const SLIME_DIATOM_SPRITE = {
  sizePx: 64,
  span: 2.2,
  detailPx: 10,
  spriteBelowPx: [14, 12, 14],
  hideBelowPx: [3, 3, 4],
} as const;

/** The diatoms' pictures in their atlas, in this order, each a full ladder: bright field, then dark field. */
export const SLIME_DIATOM_ATLAS_SLOT = {
  cocconeis: 0,
  cocconeisDark: 1,
  pennate: 2,
  pennateDark: 3,
  licmophora: 4,
} as const;

/** The ways a floor diatom is drawn, as the vertex shader hands them on: hidden, a speck, the small sprite, its ladder. */
export const SLIME_DIATOM_MODE = { hidden: 0, dot: 1, sprite: 2, ladder: 3 } as const;

/** The floor diatoms' kinds, in the mockup's roll order. */
export const SLIME_DIATOM_KIND = { cocconeis: 0, pennate: 1, licmophora: 2 } as const;
export type SlimeDiatomKind = (typeof SLIME_DIATOM_KIND)[keyof typeof SLIME_DIATOM_KIND];

/**
 * Each picture's box round its origin in its own unit, the halo left out (it is drawn by the shader or a sprite of its
 * own): it holds the body, rim and glint; `SLIME_PICTURE_MARGIN_PX` css px more each way hold the rim's least width.
 */
export const SLIME_PICTURE_BOXES = {
  cocconeis: { left: -0.52, top: -0.35, right: 0.52, bottom: 0.35 },
  pennate: { left: -0.52, top: -0.12, right: 0.52, bottom: 0.12 },
  licmophora: { left: -0.47, top: -0.54, right: 1.06, bottom: 0.54 },
  nauplius: { left: -0.52, top: -0.3, right: 0.46, bottom: 0.3 },
  ciliate: { left: -0.52, top: -0.35, right: 0.52, bottom: 0.35 },
  dino: { left: -0.52, top: -0.5, right: 0.52, bottom: 0.5 },
} as const;

/** Css px round every picture's box: half the thinnest line and its antialiasing. */
export const SLIME_PICTURE_MARGIN_PX = 2;
