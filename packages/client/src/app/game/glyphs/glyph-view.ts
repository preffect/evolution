// A glyph turned into what the SVG binds (docs/visual-style/ui-type.md §7.1 and §7.2): the medallion frame then the
// glyph's layers, each one `<path>` with its paint as attributes, its gradient as a def with an id unique to the
// drawing, its tilt and pool offset as a wrapping group's transform and its idle motion as a class, a period and a
// pivot. The list LOD drops the interior detail a 20 px glyph cannot show, enlarges the glyph inside its frame and
// thickens its strokes so they stay a pixel wide. It takes a `GlyphDrawing`, so a trait glyph and a subject glyph
// are one builder and one stylesheet, never two. Pure.

import { GLYPH_FRAME_LAYERS } from '../render/constants/trait-glyph-frame';
import {
  GLYPH_CENTRE,
  GLYPH_FRAME,
  GLYPH_NO_TILT,
  GLYPH_HALO_FALLOFF,
  GLYPH_LIST_STROKE_BOOST,
  GLYPH_LIST_ZOOM,
  GLYPH_RAMP_LIGHT,
} from '../render/constants/trait-glyph-layers';
import {
  GLYPH_ROLE,
  type GlyphFill,
  type GlyphLayer,
  type GlyphMotion,
  type GlyphShape,
  type GlyphStroke,
  type GlyphDrawing,
} from '../render/svg-glyph';

/** `card` on a card's medallion or an encyclopedia tile; `list` at one line of text, where the interior detail drops. */
export const GLYPH_LOD = { card: 'card', list: 'list' } as const;
export type GlyphLod = (typeof GLYPH_LOD)[keyof typeof GLYPH_LOD];

const NO_PAINT = 'none';
/** A dashed stroke ends square, so a thicker list-LOD stroke keeps its gaps (pores, plates) open; every other is round. */
export const GLYPH_LINE_CAP = { round: 'round', butt: 'butt' } as const;
export type GlyphLineCap = (typeof GLYPH_LINE_CAP)[keyof typeof GLYPH_LINE_CAP];
const HALF_BOX = 0.5;
const TRANSPARENT = 0;
const OPAQUE = 1;
const UNSCALED = 1;

export interface GlyphGradientStop {
  readonly offset: number;
  readonly colour: string;
  readonly opacity: number;
}

export interface GlyphGradientView {
  readonly id: string;
  /** The falloff's centre and focus in the body's box: the top-left light for a ramp, the middle for a halo. */
  readonly fx: number;
  readonly fy: number;
  readonly radius: number;
  readonly stops: readonly GlyphGradientStop[];
}

interface FillView {
  readonly fill: string;
  readonly fillOpacity: number;
}

interface StrokeView {
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly strokeOpacity: number;
  readonly dash: string | null;
  readonly lineCap: GlyphLineCap;
}

interface MotionView {
  /** `motion motion-<kind>`, else null. */
  readonly motionClass: string | null;
  readonly animationDuration: string | null;
  readonly transformOrigin: string | null;
}

export interface GlyphLayerView extends FillView, StrokeView, MotionView {
  readonly d: string;
  /** `translate(x y) rotate(deg 50 50)`: the pool's offset stays down-right on screen whatever the tilt. Null for none. */
  readonly transform: string | null;
  /** The medallion disc, for the glyph's own layers; null for the frame, which draws its own rim. */
  readonly clipPath: string | null;
}

/** The disc the glyph is clipped to, as a def: the medallion is the stage, so no halo or tail reaches the panel. */
export interface GlyphClipView {
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

export interface GlyphView {
  /** The frame's layers, then the glyph's, in draw order. */
  readonly layers: readonly GlyphLayerView[];
  readonly gradients: readonly GlyphGradientView[];
  readonly clip: GlyphClipView;
}

/** Every shape as one path, so the SVG binds a single element kind. */
export function shapePathData(shape: GlyphShape): string {
  if (shape.kind === 'path') return shape.d;
  const [radiusX, radiusY] = shape.kind === 'circle' ? [shape.r, shape.r] : [shape.rx, shape.ry];
  const arc = `a${radiusX} ${radiusY} 0 1 0`;
  return `M${shape.cx - radiusX} ${shape.cy} ${arc} ${radiusX + radiusX} 0 ${arc} ${-(radiusX + radiusX)} 0 Z`;
}

function gradientFor(fill: GlyphFill, id: string): GlyphGradientView | null {
  if (fill.kind === 'ramp') {
    const { ramp, opacity } = fill;
    return {
      id,
      fx: GLYPH_RAMP_LIGHT.fx,
      fy: GLYPH_RAMP_LIGHT.fy,
      radius: GLYPH_RAMP_LIGHT.reach,
      stops: [
        { offset: 0, colour: ramp.light, opacity },
        { offset: GLYPH_RAMP_LIGHT.baseStop, colour: ramp.base, opacity },
        { offset: 1, colour: ramp.dark, opacity },
      ],
    };
  }
  if (fill.kind === 'halo') {
    const { colour, opacity } = fill;
    return {
      id,
      fx: HALF_BOX,
      fy: HALF_BOX,
      radius: HALF_BOX,
      stops: [
        { offset: 0, colour, opacity },
        { offset: GLYPH_HALO_FALLOFF.softStop, colour, opacity: opacity * GLYPH_HALO_FALLOFF.softShare },
        { offset: 1, colour, opacity: TRANSPARENT },
      ],
    };
  }
  return null;
}

function fillView(fill: GlyphFill | undefined, gradient: GlyphGradientView | null): FillView {
  if (gradient !== null) return { fill: `url(#${gradient.id})`, fillOpacity: OPAQUE };
  if (fill?.kind === 'solid') return { fill: fill.colour, fillOpacity: fill.opacity };
  return { fill: NO_PAINT, fillOpacity: OPAQUE };
}

function strokeView(stroke: GlyphStroke | undefined, widthScale: number): StrokeView {
  if (stroke === undefined) {
    return { stroke: NO_PAINT, strokeWidth: 0, strokeOpacity: OPAQUE, dash: null, lineCap: GLYPH_LINE_CAP.round };
  }
  return {
    stroke: stroke.colour,
    strokeWidth: stroke.width * widthScale,
    strokeOpacity: stroke.opacity,
    dash: stroke.dash ?? null,
    lineCap: stroke.dash === undefined ? GLYPH_LINE_CAP.round : GLYPH_LINE_CAP.butt,
  };
}

function motionView(motion: GlyphMotion | undefined): MotionView {
  if (motion === undefined) return { motionClass: null, animationDuration: null, transformOrigin: null };
  return {
    motionClass: `motion motion-${motion.kind}`,
    animationDuration: `${motion.periodMs}ms`,
    transformOrigin: `${motion.originX}px ${motion.originY}px`,
  };
}

interface LayerGroup {
  readonly layers: readonly GlyphLayer[];
  readonly idPrefix: string;
  readonly tiltDeg: number;
  readonly strokeWidthScale: number;
  readonly zoom: number;
  /** What the group's layers are clipped to; the frame's are not clipped. */
  readonly clipPath: string | null;
}

/** A scale about the glyph's centre as one matrix: `zoom` 0 0 `zoom` and the shift that keeps the centre put. */
function zoomAboutCentre(zoom: number): string {
  const shift = (UNSCALED - zoom) * GLYPH_CENTRE;
  return `matrix(${zoom} 0 0 ${zoom} ${shift} ${shift})`;
}

function transformFor(layer: GlyphLayer, group: LayerGroup): string | null {
  const parts = [
    layer.offset === undefined ? null : `translate(${layer.offset.x} ${layer.offset.y})`,
    group.tiltDeg === GLYPH_NO_TILT ? null : `rotate(${group.tiltDeg} ${GLYPH_CENTRE} ${GLYPH_CENTRE})`,
    group.zoom === UNSCALED ? null : zoomAboutCentre(group.zoom),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(' ');
}

function layerViews(group: LayerGroup, gradients: GlyphGradientView[]): readonly GlyphLayerView[] {
  return group.layers.map((layer, index) => {
    const gradient = layer.fill === undefined ? null : gradientFor(layer.fill, `${group.idPrefix}-${index}`);
    if (gradient !== null) gradients.push(gradient);
    return {
      d: shapePathData(layer.shape),
      transform: transformFor(layer, group),
      clipPath: group.clipPath,
      ...fillView(layer.fill, gradient),
      ...strokeView(layer.stroke, group.strokeWidthScale),
      ...motionView(layer.motion),
    };
  });
}

/** The glyph's layers at a LOD: `list` keeps the silhouette and signature, never the interior detail. */
export function layersAtLod(glyph: GlyphDrawing, lod: GlyphLod): readonly GlyphLayer[] {
  return lod === GLYPH_LOD.card ? glyph.layers : glyph.layers.filter((layer) => layer.role !== GLYPH_ROLE.detail);
}

/** One drawing of `glyph`: `idPrefix` must be unique in the document, since gradient ids are global. */
export function glyphView(glyph: GlyphDrawing, lod: GlyphLod, idPrefix: string): GlyphView {
  const gradients: GlyphGradientView[] = [];
  const clip: GlyphClipView = {
    id: `${idPrefix}-clip`,
    cx: GLYPH_CENTRE,
    cy: GLYPH_CENTRE,
    radius: GLYPH_FRAME.radius,
  };
  const frame = layerViews(
    {
      layers: GLYPH_FRAME_LAYERS,
      idPrefix: `${idPrefix}-frame`,
      tiltDeg: GLYPH_NO_TILT,
      strokeWidthScale: UNSCALED,
      zoom: UNSCALED,
      clipPath: null,
    },
    gradients,
  );
  const isList = lod === GLYPH_LOD.list;
  const strokeWidthScale = isList ? GLYPH_LIST_STROKE_BOOST : UNSCALED;
  const zoom = isList ? GLYPH_LIST_ZOOM : UNSCALED;
  const layers = layerViews(
    {
      layers: layersAtLod(glyph, lod),
      idPrefix,
      tiltDeg: glyph.tiltDeg,
      strokeWidthScale,
      zoom,
      clipPath: `url(#${clip.id})`,
    },
    gradients,
  );
  return { layers: [...frame, ...layers], gradients, clip };
}
