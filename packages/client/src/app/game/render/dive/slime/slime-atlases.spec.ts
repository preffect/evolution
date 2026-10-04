// The slime's sprites, drawn once a page (docs/rendering/opening-dive.md §4, ticket #803): each picture drawn in its
// margin box at its rung and clipped to its cell; the diatoms' atlas holding every rung of every ladder in the order
// the shader reads it, then the small sprites; the bacteria's atlas cell by cell; the plankton's ladders smallest
// rungs first, each to its own top; and the whole bake, scatters first, in many short steps on the dive's clock.

import { describe, expect, it } from 'vitest';
import { SLIME_SPRITE_LADDER } from '../../constants/dive-slime';
import { SLIME_DIATOM_SPRITE, SLIME_PICTURE_BOXES, SLIME_PICTURE_MARGIN_PX } from '../../constants/dive-slime-diatoms';
import { SLIME_MOTE_SPRITE, SLIME_ROD_SPRITE } from '../../constants/dive-slime-bacteria';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import {
  SLIME_BAKE_TEST_TIMEOUT_MS,
  quickSlimeBake,
  runBake,
  testSlimeScatters,
} from '../../../../../testing/slime-builder';
import {
  DIATOM_ATLAS_SLOTS,
  bacteriaAtlasLayout,
  bakeBacteriaAtlas,
  bakeDiatomAtlas,
  bakePlanktonLadders,
  diatomAtlasPlan,
} from './slime-atlases';
import { SlimeBakes, slimeBaker } from './slime-bakes';
import { DIATOM_PICTURES, drawPictureInto, marginBox, pictureSize } from './slime-pictures';
import { SLIME_DIATOM_ENTRIES, SLIME_DIATOM_RUNGS, SLIME_DIATOM_SMALL_ENTRY } from './slime-shader-diatoms';
import { ladderSizes } from './slime-sprite-ladder';

describe('a picture at a rung', () => {
  it('takes its box and the margin’s css px each way, at its rung’s px to the unit', () => {
    const box = SLIME_PICTURE_BOXES.pennate;
    const drawn = marginBox(box, 20);
    expect(drawn.left).toBeCloseTo(box.left - SLIME_PICTURE_MARGIN_PX / 20, 12);
    const [width, height] = pictureSize(box, { unitPx: 20, scale: 2 });
    expect(width).toBe(Math.ceil((drawn.right - drawn.left) * 40));
    expect(height).toBe(Math.ceil((drawn.bottom - drawn.top) * 40));
  });

  it('draws clipped to its cell, its origin where its margin box puts it', () => {
    const canvas = createFakeShoreCanvasFactory().create(100, 100);
    const cell = { x: 10, y: 20, width: 50, height: 30 };
    drawPictureInto(canvas.context, DIATOM_PICTURES.licmophora, { unitPx: 20, scale: 1 }, cell);
    const { ops, calls } = canvas.context;
    expect(ops.slice(0, 4)).toEqual(['save', 'beginPath', 'rect', 'clip']);
    const transform = calls.find((call) => call.name === 'setTransform')!;
    const drawn = marginBox(SLIME_PICTURE_BOXES.licmophora, 20);
    expect(transform.args).toEqual([20, 0, 0, 20, 10 - drawn.left * 20, 20 - drawn.top * 20]);
    expect(ops.at(-1)).toBe('restore');
  });
});

describe('the diatoms’ atlas', () => {
  it('plans every rung of each ladder slot in the shader’s order, then the three small sprites at their fixed size', () => {
    const plan = diatomAtlasPlan(2);
    expect(plan.sizes).toEqual(SLIME_DIATOM_RUNGS);
    expect(plan.items).toHaveLength(SLIME_DIATOM_ENTRIES);
    expect(plan.items[1]!.rung).toEqual({ unitPx: SLIME_DIATOM_RUNGS[1], scale: 2 });
    expect(SLIME_DIATOM_SMALL_ENTRY).toBe(DIATOM_ATLAS_SLOTS * SLIME_DIATOM_RUNGS.length);
    const small = plan.items[SLIME_DIATOM_SMALL_ENTRY]!.rung;
    expect(small.unitPx * small.scale).toBeCloseTo(SLIME_DIATOM_SPRITE.sizePx / SLIME_DIATOM_SPRITE.span, 9);
  });

  it(
    'draws a picture a step into its own cell, and records where each went',
    () => {
      const factory = createFakeShoreCanvasFactory();
      const { result, steps } = runBake(bakeDiatomAtlas(factory, 1));
      expect(steps).toBe(SLIME_DIATOM_ENTRIES);
      expect(result.entries).toHaveLength(SLIME_DIATOM_ENTRIES);
      expect(factory.canvases).toHaveLength(1);
      expect(factory.canvases[0]!.context.ops.filter((name) => name === 'clip').length).toBeGreaterThanOrEqual(
        SLIME_DIATOM_ENTRIES,
      );
      const top = result.entries[SLIME_DIATOM_RUNGS.length - 1]!;
      expect(top.rect.width).toBe(
        pictureSize(SLIME_PICTURE_BOXES.cocconeis, { unitPx: SLIME_DIATOM_RUNGS.at(-1)!, scale: 1 })[0],
      );
    },
    SLIME_BAKE_TEST_TIMEOUT_MS,
  );
});

describe('the bacteria’s atlas', () => {
  it('lays the rods along the top and the specks under them, each drawn in its own cell', () => {
    const layout = bacteriaAtlasLayout();
    expect(layout.rods.map((rect) => rect.x)).toEqual([0, 1, 2].map((kind) => kind * SLIME_ROD_SPRITE.canvas.width));
    expect(layout.motes[1]).toEqual({
      x: SLIME_MOTE_SPRITE.size,
      y: SLIME_ROD_SPRITE.canvas.height,
      width: SLIME_MOTE_SPRITE.size,
      height: SLIME_MOTE_SPRITE.size,
    });
    const factory = createFakeShoreCanvasFactory();
    const { result } = runBake(bakeBacteriaAtlas(factory));
    expect(result.canvas.width).toBe(layout.width);
    expect(factory.canvases[0]!.context.ops.filter((name) => name === 'clip').length).toBe(5 + 3 + 1);
  });
});

describe('the plankton’s ladders', () => {
  it(
    'draws each layer’s rungs smallest first across the layers, each ladder to its own top, a rung a step',
    () => {
      const factory = createFakeShoreCanvasFactory();
      const { result, steps } = runBake(bakePlanktonLadders(factory, 1));
      const top = SLIME_SPRITE_LADDER.maxPx;
      expect(result.nauplius.map((rung) => rung.unitPx)).toEqual(ladderSizes(top.nauplius));
      expect(result.dinoRim.map((rung) => rung.unitPx)).toEqual(ladderSizes(top.dino));
      expect(result.pennateDark.map((rung) => rung.unitPx)).toEqual(ladderSizes(top.pennate));
      const total = Object.values(result).reduce((sum, rungs) => sum + rungs.length, 0);
      expect(steps).toBe(total);
      expect(factory.canvases[0]!.width).toBeLessThan(factory.canvases.at(-1)!.width);
    },
    SLIME_BAKE_TEST_TIMEOUT_MS,
  );
});

describe('SlimeBakes', () => {
  it('makes its scatters first, then its pictures, in short steps on the dive’s clock', () => {
    function* quickScatters() {
      yield;
      return testSlimeScatters();
    }
    const bakes = new SlimeBakes(
      { factory: createFakeShoreCanvasFactory(), devicePixelRatio: 1 },
      quickSlimeBake(3),
      quickScatters,
    );
    let nowMs = 0;
    const baker = slimeBaker(bakes, () => (nowMs += 1));
    expect(bakes.scatters).toBeNull();
    expect(baker.pumpBakes(3)).toBe(true);
    expect(bakes.scatters).not.toBeNull();
    expect(bakes.baked).toBeNull();
    expect(baker.isBaked).toBe(false);
    while (!baker.isBaked) baker.pumpBakes(2);
    expect(bakes.baked).not.toBeNull();
    expect(baker.pumpBakes(2)).toBe(false);
  });
});
