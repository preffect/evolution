// The time a dive spec doing seconds of real work is allowed (docs/rendering/opening-dive.md §7, ticket #818): one
// ceiling for every such spec under `render/dive/`, in place of one constant per band.

/**
 * Time allowed for a dive spec that runs real bakes or steps the dive through hundreds of frames: the shore's tiles
 * and levels, the kelp's blade tile, distances and beads, the slime's cells, ladders and bands, the planet's coastline
 * bakes, a whole fall at DPR 2. Each takes one to nine seconds alone and several times that in the full client suite
 * under coverage on the loaded 4-core box, past vitest's 5 s default: four dive specs timed out in a week (PR #808's
 * and PR #810's merge gates, the main gate after PR #815; 12 s seen for three slime bands). A ceiling, not a budget:
 * it only fails a spec that hangs.
 */
export const DIVE_HEAVY_TEST_TIMEOUT_MS = 120_000;
