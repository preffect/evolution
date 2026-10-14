// The shore shader's uniform and texture names (docs/rendering/opening-dive.md §4, ticket #801): the one table the GLSL
// (`shore-shader-*.ts`) and the mesh that feeds it (`shore-mesh.ts`) share.

export const SHORE_SHADER = {
  /** x, y: the stage in CSS px; z: CSS px per metre; w: the flat forest's weight under the land (0 or 1). */
  view: 'uShoreView',
  /** x, y: the level's half extent in metres; z, w: the next level's. */
  coarse: 'uShoreCoarse',
  /** The next level's crossfade, 0 → 1 over the step. */
  fineWeight: 'uShoreFineWeight',
  /** The band's fade over the planet. */
  bandAlpha: 'uShoreBandAlpha',
  /** x, y: the distance grid's size in cells; z: its cells per metre; w: whether the level has stones in the water. */
  data: 'uShoreData',
  /** z: the sea's table's step in metres; w: its entries. */
  level: 'uShoreLevel',
  /** The sheets' placement (tile metres, turn, offset): two caustics, the swell, two ripples, two glints, the floor. */
  sheets: 'uShoreSheets',
  /** Their strengths in that order, packed four to a vector, the floor's last. */
  sheetAlphas: 'uShoreSheetAlphas',
  /** Each breaker: how far out (metres), its strength, its width (metres), its dashes' offset (metres). */
  breakers: 'uShoreBreakers',
  /** x: the close surf is on; y: the breakers' lace tile weight; z: the swash's distance out; w: its lace's width. */
  surf: 'uShoreSurf',
  /** x: the swash lace's tile weight; y: the farthest out a breaker can paint (metres). */
  swash: 'uShoreSwash',
  /** The foam tile's mean colour and coverage, for the lace far off. */
  foamMean: 'uShoreFoamMean',
  foamColour: 'uShoreFoamColour',
  landColour: 'uShoreLandColour',
  seaColour: 'uShoreSeaColour',
  coarseTexture: 'uShoreCoarseTexture',
  fineTexture: 'uShoreFineTexture',
  dataTexture: 'uShoreDataTexture',
  stonesTexture: 'uShoreStonesTexture',
  causticTexture: 'uShoreCausticTexture',
  swellTexture: 'uShoreSwellTexture',
  rippleTexture: 'uShoreRippleTexture',
  glintTexture: 'uShoreGlintTexture',
  foamTexture: 'uShoreFoamTexture',
  floorTexture: 'uShoreFloorTexture',
  rampTexture: 'uShoreRampTexture',
} as const;

/** The sheets in the order `uShoreSheets` holds them. */
export const SHORE_SHEET_COUNT = 8;
/** `uShoreSheetAlphas` holds the eight strengths four to a vector. */
export const SHORE_SHEET_ALPHA_VECTORS = 2;

/** The next level's edge fades over this share of it, so its rect never shows as a seam. */
export const SHORE_LIVE_FEATHER = 0.04;

/** The uniform group the shore's numbers live in. */
export const SHORE_UNIFORM_GROUP = 'shoreUniforms';
