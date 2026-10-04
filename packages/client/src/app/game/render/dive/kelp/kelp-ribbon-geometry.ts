// The kelp's ribbons as one mesh each draw (docs/rendering/opening-dive.md §4, ticket #802): every ribbon a strip of
// quads between its left and right margins, in metres, its shadow first where it casts one, in the order the mockup
// draws them. Each vertex carries the ribbon's frame (tangent, how far across, which end) and its widths, so the
// shader paints the fill, the grain, the ruffles, the midline and the margins as the mockup's strokes, and the vertex
// shader pushes the strip out by the strokes' reach, which is a pixel count, each frame.

import { Geometry } from 'pixi.js';
import { KELP_RIBBON_KIND } from '../../constants/dive-kelp';
import type { Ribbon } from './kelp-ribbons';

export { KELP_RIBBON_KIND };
export type KelpRibbonKind = (typeof KELP_RIBBON_KIND)[keyof typeof KELP_RIBBON_KIND];

/** One ribbon of a mesh: its kind, and the shadow it casts first (`null` for none), offset in metres. */
export interface KelpRibbonDraw {
  readonly ribbon: Ribbon;
  readonly kind: KelpRibbonKind;
  readonly shadowOffset: readonly [number, number] | null;
}

/** The attributes' names, as the vertex shader declares them. */
export const KELP_RIBBON_ATTRIBUTE = {
  position: 'aPosition',
  /** Tangent x, y; how far across (+ left, − right, metres); which end (−1 the start, +1 the end, 0 between). */
  frame: 'aFrame',
  /** Arc length, left and right half widths, the ribbon's length (metres). */
  ribbon: 'aRibbon',
  /** Kind, and 1 for a shadow. */
  style: 'aStyle',
} as const;

const POSITION_FLOATS = 2;
const VERTICES_PER_SAMPLE = 2;
const SHADOW = 1;
const NOT_SHADOW = 0;
const START = -1;
const END = 1;

interface Arrays {
  readonly position: number[];
  readonly frame: number[];
  readonly ribbon: number[];
  readonly style: number[];
  readonly index: number[];
}

/** One strip: two vertices a sample, two triangles between each pair of samples. */
function pushStrip(arrays: Arrays, draw: KelpRibbonDraw, isShadow: boolean): void {
  const { ribbon, kind } = draw;
  const [offsetX, offsetY] = isShadow && draw.shadowOffset !== null ? draw.shadowOffset : [0, 0];
  const first = arrays.position.length / POSITION_FLOATS;
  const last = ribbon.samples.length - 1;
  ribbon.samples.forEach((sample, index) => {
    const end = index === 0 ? START : index === last ? END : 0;
    const leftX = -sample.tangentY;
    const leftY = sample.tangentX;
    for (const lateral of [sample.leftM, -sample.rightM]) {
      arrays.position.push(sample.x + leftX * lateral + offsetX, sample.y + leftY * lateral + offsetY);
      arrays.frame.push(sample.tangentX, sample.tangentY, lateral, end);
      arrays.ribbon.push(sample.u, sample.leftM, sample.rightM, ribbon.lengthM);
      arrays.style.push(kind, isShadow ? SHADOW : NOT_SHADOW);
    }
    if (index === 0) return;
    const left = first + index * VERTICES_PER_SAMPLE;
    const previous = left - VERTICES_PER_SAMPLE;
    arrays.index.push(previous, left, left + 1, previous, left + 1, previous + 1);
  });
}

/** The mesh's arrays: each ribbon's shadow (when it casts one), then the ribbon, in the order given. */
export function kelpRibbonArrays(draws: readonly KelpRibbonDraw[]): Arrays {
  const arrays: Arrays = { position: [], frame: [], ribbon: [], style: [], index: [] };
  for (const draw of draws) {
    if (draw.shadowOffset !== null) pushStrip(arrays, draw, true);
    pushStrip(arrays, draw, false);
  }
  return arrays;
}

/** The ribbons' geometry, uploaded once. */
export function kelpRibbonGeometry(draws: readonly KelpRibbonDraw[]): Geometry {
  const arrays = kelpRibbonArrays(draws);
  return new Geometry({
    attributes: {
      [KELP_RIBBON_ATTRIBUTE.position]: { buffer: Float32Array.from(arrays.position), format: 'float32x2' },
      [KELP_RIBBON_ATTRIBUTE.frame]: { buffer: Float32Array.from(arrays.frame), format: 'float32x4' },
      [KELP_RIBBON_ATTRIBUTE.ribbon]: { buffer: Float32Array.from(arrays.ribbon), format: 'float32x4' },
      [KELP_RIBBON_ATTRIBUTE.style]: { buffer: Float32Array.from(arrays.style), format: 'float32x2' },
    },
    indexBuffer: new Uint32Array(arrays.index),
  });
}
