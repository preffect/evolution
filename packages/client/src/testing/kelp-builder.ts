// The kelp band's spec builders (docs/rendering/opening-dive.md §7, ticket #802): quick stand-ins for its once-a-page
// bakes (a texel or two of each, over recording canvases), so a band or session spec runs in milliseconds, and the
// time a spec running the real bakes is allowed.

import type { KelpBakeSources, KelpBaked } from '../app/game/render/dive/kelp/kelp-bakes';
import { encodeSignedDistance } from '../app/game/render/dive/planet/signed-distance';

/**
 * Time allowed for a spec that runs the real bakes (the blade's 512² tile and the rock's and the sea's signed
 * distances, a few seconds of per-pixel work on a loaded 4-core box): far past vitest's 5 s default.
 */
export const KELP_BAKE_TEST_TIMEOUT_MS = 120_000;

const QUICK_TILE_PX = 8;
const QUICK_DISTANCE_TEXELS = 2;
const RGBA = 4;
/** The quick bakes' boxes: two texels a metre wide each way round the focus. */
const QUICK_BOX = [-1, -1, 1, 1] as const;

/** A signed distance of two texels, `metres` everywhere. */
function flatDistance(metres: number): KelpBaked['rock'] {
  const data = new Uint8Array(QUICK_DISTANCE_TEXELS * QUICK_DISTANCE_TEXELS * RGBA);
  for (let texel = 0; texel < QUICK_DISTANCE_TEXELS * QUICK_DISTANCE_TEXELS; texel += 1) {
    encodeSignedDistance(data, texel, metres);
  }
  return { data, width: QUICK_DISTANCE_TEXELS, height: QUICK_DISTANCE_TEXELS, box: QUICK_BOX, metresPerTexel: 1 };
}

/** Bakes everything in `slices` steps: a small tile, flat distances, and one bead at the focus. */
export function quickKelpBake(slices = 1): (sources: KelpBakeSources) => Generator<void, KelpBaked> {
  return function* bake(sources) {
    for (let slice = 0; slice < slices; slice += 1) yield;
    return {
      bladeTile: sources.factory.create(QUICK_TILE_PX, QUICK_TILE_PX),
      rock: flatDistance(1),
      sea: flatDistance(-1),
      isRockOnLandKept: true,
      beads: [{ x: 0, y: 0, radiusM: 0.001 }],
    };
  };
}
