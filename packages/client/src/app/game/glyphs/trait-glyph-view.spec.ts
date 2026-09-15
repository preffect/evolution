import { describe, expect, it } from 'vitest';
import { GLYPH_FRAME_LAYERS } from '../render/constants/trait-glyph-frame';
import {
  GLYPH_LIST_STROKE_BOOST,
  GLYPH_LIST_ZOOM,
  GLYPH_PERIOD_MS,
  GLYPH_POOL,
} from '../render/constants/trait-glyph-layers';
import { GLYPH_ROLE, circle, ellipse, path } from '../render/svg-glyph';
import { TRAIT_GLYPHS } from './trait-glyphs';
import { TRAIT_GLYPH_LOD, shapePathData, traitGlyphView } from './trait-glyph-view';

const MITOCHONDRION = TRAIT_GLYPHS.mitochondrion;

describe('shapePathData', () => {
  it('draws a circle and an ellipse as two arcs from their left edge, and passes a path through', () => {
    expect(shapePathData(circle(50, 50, 10))).toBe('M40 50 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 Z');
    expect(shapePathData(ellipse(50, 50, 20, 8))).toBe('M30 50 a20 8 0 1 0 40 0 a20 8 0 1 0 -40 0 Z');
    expect(shapePathData(path('M0 0 L1 1'))).toBe('M0 0 L1 1');
  });
});

describe('traitGlyphView', () => {
  const view = traitGlyphView(MITOCHONDRION, TRAIT_GLYPH_LOD.card, 'drawing-a');

  it('draws the frame first, untilted, then every glyph layer tilted about the centre', () => {
    expect(view.layers).toHaveLength(GLYPH_FRAME_LAYERS.length + MITOCHONDRION.layers.length);
    expect(view.layers.slice(0, GLYPH_FRAME_LAYERS.length).every((layer) => layer.transform === null)).toBe(true);
    const body =
      view.layers[
        GLYPH_FRAME_LAYERS.length + MITOCHONDRION.layers.findIndex((layer) => layer.role === GLYPH_ROLE.body)
      ];
    expect(body?.transform).toBe(`rotate(${MITOCHONDRION.tiltDeg} 50 50)`);
  });

  it('offsets a pool on screen before the tilt, so its shade stays down-right', () => {
    const poolIndex = MITOCHONDRION.layers.findIndex((layer) => layer.role === GLYPH_ROLE.pool);
    expect(view.layers[GLYPH_FRAME_LAYERS.length + poolIndex]?.transform).toBe(
      `translate(${GLYPH_POOL.offsetX} ${GLYPH_POOL.offsetY}) rotate(${MITOCHONDRION.tiltDeg} 50 50)`,
    );
  });

  it('gives every ramp and halo a gradient with an id under the prefix, and fills with a reference to it', () => {
    const ids = view.gradients.map((gradient) => gradient.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('drawing-a-'))).toBe(true);
    const references = view.layers.filter((layer) => layer.fill.startsWith('url(')).map((layer) => layer.fill);
    expect(references).toEqual(ids.map((id) => `url(#${id})`));
  });

  it('fades a halo to transparent and lights a ramp from the top-left', () => {
    const haloFill = view.gradients.find((gradient) => gradient.stops.at(-1)?.opacity === 0);
    expect(haloFill).toBeDefined();
    const ramp = view.gradients.find((gradient) => gradient.fx < 0.5 && gradient.fy < 0.5);
    expect(ramp?.stops.map((stop) => stop.offset)).toEqual([0, 0.5, 1]);
  });

  it('binds an idle motion as a class, its period and its pivot', () => {
    const moving = view.layers.find((layer) => layer.motionClass !== null);
    expect(moving?.motionClass).toBe('motion motion-beat');
    expect(moving?.animationDuration).toBe(`${GLYPH_PERIOD_MS.beat}ms`);
    expect(moving?.transformOrigin).toBe('50px 50px');
  });

  it('drops the interior detail at the list LOD and keeps the frame', () => {
    const list = traitGlyphView(MITOCHONDRION, TRAIT_GLYPH_LOD.list, 'drawing-b');
    const detailCount = MITOCHONDRION.layers.filter((layer) => layer.role === GLYPH_ROLE.detail).length;
    expect(detailCount).toBeGreaterThan(0);
    expect(list.layers).toHaveLength(view.layers.length - detailCount);
  });

  it('enlarges the glyph about its centre at the list LOD, after its tilt, and never the frame', () => {
    const list = traitGlyphView(MITOCHONDRION, TRAIT_GLYPH_LOD.list, 'drawing-e');
    const shift = (1 - GLYPH_LIST_ZOOM) * 50;
    expect(list.layers[0]?.transform).toBeNull();
    expect(list.layers.at(-1)?.transform).toBe(
      `rotate(${MITOCHONDRION.tiltDeg} 50 50) matrix(${GLYPH_LIST_ZOOM} 0 0 ${GLYPH_LIST_ZOOM} ${shift} ${shift})`,
    );
  });

  it('thickens the glyph strokes at the list LOD and leaves the frame rim alone', () => {
    const list = traitGlyphView(TRAIT_GLYPHS.cilia, TRAIT_GLYPH_LOD.list, 'drawing-c');
    const full = traitGlyphView(TRAIT_GLYPHS.cilia, TRAIT_GLYPH_LOD.card, 'drawing-d');
    expect(list.layers[0]?.strokeWidth).toBe(full.layers[0]?.strokeWidth);
    const hairs = TRAIT_GLYPHS.cilia.layers.findIndex((layer) => layer.role === GLYPH_ROLE.signature);
    const index = GLYPH_FRAME_LAYERS.length + hairs;
    expect(list.layers[index]?.strokeWidth).toBeCloseTo(
      (full.layers[index]?.strokeWidth ?? 0) * GLYPH_LIST_STROKE_BOOST,
    );
  });
});
