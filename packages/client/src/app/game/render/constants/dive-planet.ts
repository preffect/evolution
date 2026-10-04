// The opening dive's planet band on the game's renderer (docs/rendering/opening-dive.md §4, ticket #800): the
// coastline bakes, the shader's zoom fades, its light and its resolution. Every value is the mockup's
// (https://claude.ai/artifact/A674H91iLRxEa4MTzCRPhu, `20-globe.js`): its source names the same number at the place
// this comment says. The shader's own palette and relief (the biomes, the ranges and volcanoes of the Salish region)
// are named inside its GLSL (`dive/planet/dive-planet-shader-land.ts`).

// ===== The coastline bakes (dive/planet/dive-planet-bakes.ts) =====

/** The world's signed distance bake: equirectangular, a texel per 0.18° (`GS_W` × `GS_H`). */
export const DIVE_PLANET_WORLD_BAKE_PX = { width: 2048, height: 1024 } as const;
/**
 * The world's quick bake, made first: the planet draws from it while the full one is made, as the mockup drew its
 * flat fallback globe (`drawGlobeFallback`), and the full one comes up over it (`DIVE_GLOBE_CROSSFADE_MS`).
 */
export const DIVE_PLANET_WORLD_PREVIEW_BAKE_PX = { width: 512, height: 256 } as const;
/** The Salish region's bake is this many texels wide (`RS_W`); its height keeps the region's shape at its latitude. */
export const DIVE_PLANET_REGION_BAKE_WIDTH_PX = 2048;
/**
 * A texel's signed distance to the coast (+ on land) in three byte channels (`bakeSdf`): red in quarter texels, green
 * in texels, blue in eight texels, each round `DIVE_SDF_ZERO_LEVEL`. The shader reads the finest channel that has not
 * saturated: red within `trustedTexels.red`, green within `trustedTexels.green`, blue past them.
 */
export const DIVE_SDF_LEVELS_PER_TEXEL = { red: 4, green: 1, blue: 0.125 } as const;
export const DIVE_SDF_TRUSTED_TEXELS = { red: 31, green: 126 } as const;
export const DIVE_SDF_ZERO_LEVEL = 128;
/** Texels this close to a coast segment take their exact distance to it, so the zero line is the vector coast. */
export const DIVE_SDF_EXACT_BAND_TEXELS = 3;
/** A texel's raster distance is measured to its centre, half a texel in from its edge (`sqrt(d) − .5`). */
export const DIVE_SDF_TEXEL_CENTRE_OFFSET = 0.5;

// ===== The planet's GPU objects (dive/planet/dive-planet-mesh.ts) =====

/** The quad the shader fills: its corners are its unit coordinates (y down), two triangles. */
export const DIVE_PLANET_QUAD = { positions: [0, 0, 1, 0, 1, 1, 0, 1], indices: [0, 1, 2, 0, 2, 3] } as const;
/** A coastline slot before its bake lands: one texel of the deepest open sea, opaque. */
export const DIVE_PLANET_OPEN_SEA_TEXEL = [0, 0, 0, 255] as const;

// ===== The shader's zoom fades (dive/planet/dive-planet-frame.ts) =====

/** Below this zoom the shader draws plane metres round the focus, not the sphere (`zz < 4.45`). */
export const DIVE_PLANET_PLANE_BELOW_ZOOM = 4.45;
/** A fade of one of the shader's terms: 0 at `fromZoom`, 1 at `toZoom`, smoothstepped (`sstep(from, to, zz)`). */
export interface DivePlanetFade {
  readonly fromZoom: number;
  readonly toZoom: number;
}
/** The coast's antialiased edge comes in as the sphere turns to plane (`uLandSdf`). */
export const DIVE_PLANET_LAND_EDGE_FADE: DivePlanetFade = { fromZoom: 4.42, toZoom: 4.62 };
/** The clouds clear on the way down (`uCloud`). */
export const DIVE_PLANET_CLOUD_FADE: DivePlanetFade = { fromZoom: 6.1, toZoom: 6.9 };
/** The Salish region's relief, snow and meadows come in over the biome colours (`uDet`). */
export const DIVE_PLANET_REGION_DETAIL_FADE: DivePlanetFade = { fromZoom: 6.5, toZoom: 6.1 };
/** The conifer crowns come in over the hillshade (`uCrown`). */
export const DIVE_PLANET_CROWN_FADE: DivePlanetFade = { fromZoom: 3.95, toZoom: 3.35 };
/** The hillshade's relief is exaggerated from `near` (close in) to `far` across its fade (`uExag`). */
export const DIVE_PLANET_RELIEF_FADE: DivePlanetFade = { fromZoom: 3.8, toZoom: 6.6 };
export const DIVE_PLANET_RELIEF_EXAGGERATION = { near: 3.4, far: 4.2 } as const;

/** The sun, from the top-left and in front: the game's light (`sun`, normalised where it is used). */
export const DIVE_PLANET_SUN_DIRECTION = { x: -0.52, y: 0.5, z: 0.69 } as const;

// ===== Resolution (dive/planet/dive-planet-resolution.ts) =====

/**
 * The planet renders at the upper bands' ratio, at most `sphere` for the planet's crisp limb and `plane` for the
 * forest under the shore (`target`). The dive's resolution governor steps the canvas under it (`dive-governor.ts`).
 */
export const DIVE_PLANET_MAX_RATIO = { sphere: 1.5, plane: 1 } as const;
