// The plankton's moving strokes (docs/rendering/opening-dive.md §4, ticket #803): worked out on the clock as the
// mockup's `nauplius`, `ciliate` and `dino` drew them — each part's count, its switch at its size, its motion — and laid
// on the stage as quads, as many as there is room for, the rest laid flat.

import { Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { SLIME_CILIATE, SLIME_DINO, SLIME_NAUPLIUS } from '../../constants/dive-slime-plankton';
import { SLIME_STROKE_PIECES } from '../../constants/dive-slime';
import {
  ciliaStrokes,
  ciliateMouthStrokes,
  dinoGirdleStrokes,
  dinoTrailingStrokes,
  hexStrokeColour,
  naupliusLimbStrokes,
  naupliusTailStrokes,
  quadraticPoints,
  strokeColourOf,
} from './slime-plankton-strokes';
import { createSlimePrograms } from './slime-programs';
import { SlimeStrokes } from './slime-strokes';

const BIG = { unitPx: 400 };
const SMALL = { unitPx: 8 };

describe('the plankton’s strokes', () => {
  it('reads the mockup’s colours, and runs a quadratic curve through its ends in straight pieces', () => {
    expect(strokeColourOf('rgba(240,226,190,.8)')).toEqual([240 / 255, 226 / 255, 190 / 255, 0.8]);
    expect(hexStrokeColour('#ffffff', 0.5)).toEqual([1, 1, 1, 0.5]);
    const points = quadraticPoints([0, 0], [1, 2], [2, 0]);
    expect(points).toHaveLength((SLIME_STROKE_PIECES.curve + 1) * 2);
    expect(points.slice(0, 2)).toEqual([0, 0]);
    expect(points.slice(-2)).toEqual([2, 0]);
    expect(points[SLIME_STROKE_PIECES.curve + 1]).toBeCloseTo(1, 9);
  });

  it('rows the larva’s six limbs on its beat, round-ended, fringed with setae once it is big enough', () => {
    expect(naupliusLimbStrokes(SMALL, 0)).toHaveLength(6);
    const big = naupliusLimbStrokes(BIG, 0);
    expect(big).toHaveLength(6 + 6 * SLIME_NAUPLIUS.setae.count);
    expect(big.every((stroke) => stroke.isRound)).toBe(true);
    const later = naupliusLimbStrokes(SMALL, 0.3);
    expect(later[0]!.points.at(-1)).not.toBe(naupliusLimbStrokes(SMALL, 0)[0]!.points.at(-1));
    expect(naupliusTailStrokes(SMALL, 0)).toHaveLength(2);
  });

  it('beats the ciliate’s cilia in a travelling wave once it is big enough, and pulses its vacuole', () => {
    expect(ciliaStrokes(SMALL, 0, 0)).toEqual([]);
    const cilia = ciliaStrokes(BIG, 0, 0);
    expect(cilia).toHaveLength(SLIME_CILIATE.cilia.count);
    expect(cilia[0]!.colour[3]).toBe(SLIME_CILIATE.cilia.base);
    expect(ciliaStrokes(BIG, 0, 1)[0]!.colour[3]).toBeCloseTo(
      SLIME_CILIATE.cilia.base + SLIME_CILIATE.cilia.darkField,
      9,
    );
    const mouth = ciliateMouthStrokes(BIG, 0);
    expect(mouth).toHaveLength(1 + SLIME_CILIATE.membranelles.count);
    const ring = (time: number): number =>
      Math.abs(ciliateMouthStrokes(BIG, time)[0]!.points[0]! - SLIME_CILIATE.vacuole.x);
    expect(ring(0)).not.toBeCloseTo(ring(1), 6);
  });

  it('lays the dinoflagellate’s two flagella once it is big enough for each', () => {
    expect(dinoTrailingStrokes({ unitPx: SLIME_DINO.trailing.abovePx }, 0)).toEqual([]);
    expect(dinoGirdleStrokes({ unitPx: SLIME_DINO.girdleFlagellum.abovePx }, 0)).toEqual([]);
    const trailing = dinoTrailingStrokes(BIG, 0)[0]!;
    expect(trailing.points).toHaveLength(21 * 2);
    expect(dinoGirdleStrokes(BIG, 0)[0]!.points).toHaveLength(26 * 2);
  });
});

describe('SlimeStrokes', () => {
  const shader = createSlimePrograms().strokes.shader;

  it('lays each straight piece where its organism is on the stage, premultiplied, and shows while any is laid', () => {
    const strokes = new SlimeStrokes(shader, 4);
    strokes.begin();
    strokes.add([{ points: [0, 0, 1, 0, 1, 1], width: 0.5, colour: [1, 0, 0, 0.5], isRound: true }], {
      x: 100,
      y: 50,
      angle: Math.PI / 2,
      unitPx: 10,
    });
    strokes.end();
    expect(strokes.pieceCount).toBe(2);
    expect(strokes.mesh.visible).toBe(true);
    expect(strokes.alphaOf(0)).toBe(0.5);
    const pieces = strokes.mesh.geometry.getAttribute('aPiece').buffer.data as Float32Array;
    expect(Array.from(pieces.slice(0, 4)).map((value) => Math.round(value))).toEqual([100, 50, 100, 60]);
    strokes.begin();
    strokes.end();
    expect(strokes.mesh.visible).toBe(false);
    expect(Array.from(pieces.slice(0, 4))).toEqual([0, 0, 0, 0]);
    strokes.destroy();
  });

  it('lays no more pieces than it has room for', () => {
    const strokes = new SlimeStrokes(shader, 2);
    strokes.begin();
    strokes.add([{ points: [0, 0, 1, 0, 2, 0, 3, 0], width: 1, colour: [1, 1, 1, 1], isRound: false }], {
      x: 0,
      y: 0,
      angle: 0,
      unitPx: 1,
    });
    strokes.end();
    expect(strokes.pieceCount).toBe(2);
    strokes.destroy();
    expect(Texture.EMPTY.destroyed).toBe(false);
  });
});
