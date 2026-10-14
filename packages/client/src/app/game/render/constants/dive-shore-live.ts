// The opening dive's live sea over the shore (docs/rendering/opening-dive.md §4, ticket #801): the mockup's moving
// parts of `drawShore` (the caustics, the swell, the ripples and glints, the surf) under its own names. Kept out of the
// `render/constants` barrel: only the dive's lazily loaded shore chunk reads it.

/**
 * The sun's caustic net on the sea floor through the shallows, live (`drawShore`'s two caustic sheets): each sheet's
 * tile, turn, drift (metres a second) and strength, added over the floor where it shows.
 */
export const SHORE_CAUSTIC_SHEETS = [
  { tileM: 0.9, turn: 0.3, driftX: 0.06, driftY: 0.025, alpha: 0.17 },
  { tileM: 0.55, turn: 1.2, driftX: -0.04, driftY: 0.05, alpha: 0.12 },
] as const;

/** The swell: long soft crests 90 m apart drifting shoreward, soft-light, between z 3.4 → 2.9 and −0.2 → 0.6. */
export const SHORE_SWELL = {
  tileM: 90,
  turn: 0.15,
  driftY: 1.6,
  alpha: 0.35,
  fadeIn: { fromZoom: 3.4, toZoom: 2.9 },
  fadeOut: { fromZoom: -0.2, toZoom: 0.6 },
} as const;

/**
 * Wind ripples and sun glints at their true size (a few metres), gone once they are sub-pixel: they come up as the
 * `tileM` ripple tile grows from `fromPx` to `toPx` on screen; the drift is `drift` metres a second, each sheet's
 * offset a multiple of it; the two glint sheets breathe against each other at `twinkleRate`.
 */
export const SHORE_RIPPLES = {
  tileM: 16,
  fromPx: 70,
  toPx: 240,
  drift: 0.5,
  twinkleRate: 2.1,
  sheets: [
    { tile: 'ripple', tileShare: 1, turn: 0.4, driftX: 1, driftY: 0.6, alpha: 0.8 },
    { tile: 'ripple', tileShare: 0.37, turn: 1.9, driftX: -0.6, driftY: 0.8, alpha: 0.5 },
  ],
  glints: [
    { tileM: 9, turn: 0, driftX: -0.7, driftY: 0.4, alpha: 0.45 },
    { tileM: 9, turn: 1.3, driftX: 0.5, driftY: -0.3, alpha: 0.45 },
  ],
} as const;

/**
 * The surf close in (`drawSurf`, z ≤ 3.6): four breakers a `periodSeconds` apart roll in from `startM` + `travelM`
 * out to `startM`, wandering in and out along the shore by `wander` over `wanderM`; each is a faint wide band, a dashed
 * core and a dashed foam lace on the foam tile. The swash is foam lace hugging the waterline, breathing in and out.
 */
export const SHORE_SURF = {
  belowZoom: 3.6,
  breakers: 4,
  periodSeconds: 9,
  startM: 1.2,
  travelM: 30,
  travelPower: 1.25,
  alpha: { power: 0.8, base: 0.25, gain: 0.6 },
  width: { base: 0.16, gain: 0.75 },
  minWidthPx: 0.5,
  wander: 0.35,
  wanderM: 22,
  wanderSalt: 471,
  wanderPerBreaker: 3.1,
  band: { widthShare: 3.2, alpha: 0.1 },
  core: { widthShare: 0.45, alpha: 0.6 },
  lace: { widthShare: 1.8, alphaGain: 1.3, tileM: 2.4 },
  /**
   * The dashes (`SURF_DASH`, 3–9 m on, 1–3 m off, about three quarters on): a noise along the water `scaleM` across,
   * on above `threshold`, drifting with the clock; each breaker's starts `perBreakerM` further along.
   */
  dash: { perBreakerM: 11, driftPerSecond: 0.4, scaleM: 6, threshold: 0.4 },
  swash: {
    distanceM: 0.45,
    breathM: 0.25,
    laceMinM: 0.3,
    laceWidthPx: 1.2,
    laceTileM: 1.3,
    laceAlpha: 0.9,
    lineWidthM: 1.2,
    lineAlpha: 0.12,
  },
} as const;
