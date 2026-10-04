// The slime band's spec builders (docs/rendering/opening-dive.md §7, ticket #803): quick stand-ins for its once-a-page
// bakes (a few px of each, over recording canvases) and a few of each scatter, so a band or session spec runs in
// milliseconds, and the time a spec running the real bakes is allowed.

import { SLIME_SPRITE_LADDER } from '../app/game/render/constants/dive-slime';
import { bacteriaAtlasLayout, type PlanktonLadders } from '../app/game/render/dive/slime/slime-atlases';
import type { SlimeBakeSources, SlimeBaked } from '../app/game/render/dive/slime/slime-bakes';
import type { SlimeScatters } from '../app/game/render/dive/slime/slime-scatter';
import { PLANKTON_PICTURES, marginBox } from '../app/game/render/dive/slime/slime-pictures';
import { SLIME_DIATOM_ENTRIES, SLIME_DIATOM_RUNGS } from '../app/game/render/dive/slime/slime-shader-diatoms';
import { SLIME_PICTURE_BOXES } from '../app/game/render/constants/dive-slime-diatoms';

/**
 * Time allowed for a spec that runs the real bakes (the cells' field over a tile, the plankton's ladders and the
 * diatoms' atlas: seconds of per-pixel and recording work on a loaded 4-core box, past vitest's 5 s default).
 */
export const SLIME_BAKE_TEST_TIMEOUT_MS = 120_000;

/**
 * Time allowed for a spec that opens slime bands over the fake Pixi app (ten programs and their warm-up each): under a
 * second alone, but past vitest's 5 s default in the full client suite under coverage on a loaded 4-core box (12 s
 * seen for three bands).
 */
export const SLIME_BAND_TEST_TIMEOUT_MS = 60_000;

/** The cell tiles' size in a spec that runs the real cell bake: the field's work goes as its square. */
export const SLIME_TEST_CELL_TILE_PX = 32;

const QUICK_PX = 8;

/** Two rungs of each plankton layer, a few px each. */
function quickLadders(factory: SlimeBakeSources['factory']): PlanktonLadders {
  const rungs = [SLIME_SPRITE_LADDER.minPx, SLIME_SPRITE_LADDER.maxPx.pennate];
  const ladder = (box: (typeof SLIME_PICTURE_BOXES)[keyof typeof SLIME_PICTURE_BOXES]) =>
    rungs.map((unitPx) => ({ unitPx, canvas: factory.create(QUICK_PX, QUICK_PX), box: marginBox(box, unitPx) }));
  return {
    nauplius: ladder(PLANKTON_PICTURES.nauplius.box),
    ciliateBody: ladder(PLANKTON_PICTURES.ciliateBody.box),
    ciliateRim: ladder(PLANKTON_PICTURES.ciliateRim.box),
    dinoBody: ladder(PLANKTON_PICTURES.dinoBody.box),
    dinoRim: ladder(PLANKTON_PICTURES.dinoRim.box),
    pennate: ladder(SLIME_PICTURE_BOXES.pennate),
    pennateDark: ladder(SLIME_PICTURE_BOXES.pennate),
  };
}

/** Bakes everything in `slices` steps: small canvases, and an entry for every diatom picture. */
export function quickSlimeBake(slices = 1): (sources: SlimeBakeSources) => Generator<void, SlimeBaked> {
  return function* bake(sources) {
    for (let slice = 0; slice < slices; slice += 1) yield;
    const { factory } = sources;
    const layout = bacteriaAtlasLayout();
    const entries = Array.from({ length: SLIME_DIATOM_ENTRIES }, (_entry, index) => ({
      rect: { x: index, y: 0, width: 1, height: 1 },
      box: marginBox(SLIME_PICTURE_BOXES.cocconeis, SLIME_SPRITE_LADDER.minPx),
    }));
    return {
      bacteria: { canvas: factory.create(QUICK_PX, QUICK_PX), rods: layout.rods, motes: layout.motes },
      plankton: quickLadders(factory),
      diatoms: { canvas: factory.create(QUICK_PX, QUICK_PX), sizes: SLIME_DIATOM_RUNGS, entries },
      cells: { bright: factory.create(QUICK_PX, QUICK_PX), dark: factory.create(QUICK_PX, QUICK_PX) },
    };
  };
}

/** One of each scatter's kind, somewhere near the focus. */
export function testSlimeScatters(): SlimeScatters {
  return {
    clouds: [{ x: 1e-4, y: 1e-4, radiusM: 3e-5, alpha: 0.2 }],
    diatoms: [
      { x: 2e-4, y: 0, lengthM: 5e-5, angle: 0, kind: 0 },
      { x: 0, y: 2e-4, lengthM: 5e-5, angle: 1, kind: 2 },
    ],
    rods: [{ x: 3e-5, y: 0, lengthM: 2e-6, widthM: 6e-7, angle: 0, phase: 0, kind: 1, isInDish: false }],
    motes: [{ x: 5e-6, y: 5e-6, radiusM: 3e-7, isLipid: true, column: 3, row: 3, isInDish: true }],
  };
}

/** Steps a bake to its end and answers what it made, and how many steps it took. */
export function runBake<T>(job: Generator<void, T>): { readonly result: T; readonly steps: number } {
  let steps = 0;
  for (let step = job.next(); ; step = job.next()) {
    if (step.done === true) return { result: step.value, steps };
    steps += 1;
  }
}
