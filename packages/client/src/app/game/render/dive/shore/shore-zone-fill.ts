// An intertidal zone's cover inside the current path (docs/rendering/opening-dive.md §4, ticket #801, the mockup's
// `zoneFill`, `nearLayer`, `viewRect` and `viewPat`): its mean colour far off, the patchy far tile in the middle
// distance, and close in the near tile masked by the same patches, so the mosaic never changes as you zoom. The near
// layer is made once per snapshot per zone on a CPU canvas of the snapshot's size: the mockup made it every frame on a
// GPU canvas, and those layers were PR #799's frame spikes.

import { SHORE_LAYER_BLEED_PX, SHORE_ZONE_FADE, SHORE_ZONE_TILES } from '../../constants/dive-shore';
import { DIAMETER_PER_RADIUS, HALF, smoothstep } from '../../geometry';
import { rasterise, type ShoreCanvas } from './shore-canvas';
import { placedPattern, setCentredPixelTransform, setWorldTransform, tileOf, type ShorePaint } from './shore-paint';
import type { ShoreTileName } from './shore-tiles';

export type ZoneName = keyof typeof SHORE_ZONE_TILES;

/** A world box `[minX, minY, maxX, maxY]` in metres. */
export type WorldBox = readonly [number, number, number, number];

/** A rect in CSS px from the view's centre: `[x, y, width, height]`. */
export type ViewRect = readonly [number, number, number, number];

const FAR_SUFFIX = 'Far';

function farName(zone: ZoneName): ShoreTileName {
  return `${zone}${FAR_SUFFIX}` as ShoreTileName;
}

/** A world box as a view-centred CSS px rect cut to the view, or the whole view; `null` when off it (`viewRect`). */
export function viewRect(paint: ShorePaint, box: WorldBox | null): ViewRect | null {
  const { view } = paint;
  const bleed = SHORE_LAYER_BLEED_PX;
  const minX = -view.widthPx * HALF - bleed;
  const minY = -view.heightPx * HALF - bleed;
  const maxX = view.widthPx * HALF + bleed;
  const maxY = view.heightPx * HALF + bleed;
  if (box === null) return [minX, minY, maxX - minX, maxY - minY];
  const scale = view.pixelsPerMetre;
  const left = Math.max(minX, Math.floor(box[0] * scale) - bleed);
  const top = Math.max(minY, Math.floor(box[1] * scale) - bleed);
  const right = Math.min(maxX, Math.ceil(box[2] * scale) + bleed);
  const bottom = Math.min(maxY, Math.ceil(box[3] * scale) + bleed);
  return right > left && bottom > top ? [left, top, right - left, bottom - top] : null;
}

/** A view-wide pattern fill in CSS px (`viewPat`): a pattern scaled to 1e-7 would be dropped by the canvas. */
export function fillViewPattern(
  paint: ShorePaint,
  name: ShoreTileName,
  look: {
    readonly tileM: number;
    readonly alpha: number;
    readonly turn?: number;
    readonly offsetM?: readonly [number, number];
    readonly operation?: GlobalCompositeOperation;
    readonly rect: ViewRect;
  },
): void {
  const { context, view } = paint;
  context.save();
  setCentredPixelTransform(paint);
  const tilePx = look.tileM * view.pixelsPerMetre;
  const [offsetX, offsetY] = look.offsetM ?? [0, 0];
  const pattern = placedPattern(paint, name, {
    tileM: tilePx,
    turn: look.turn,
    offsetX: (offsetX * view.pixelsPerMetre) % tilePx,
    offsetY: (offsetY * view.pixelsPerMetre) % tilePx,
    unitPx: view.devicePixelRatio,
  });
  if (pattern !== null) {
    if (look.operation !== undefined) context.globalCompositeOperation = look.operation;
    context.globalAlpha *= look.alpha;
    context.fillStyle = pattern;
    context.fillRect(look.rect[0], look.rect[1], look.rect[2], look.rect[3]);
  }
  context.restore();
}

/** The zone's layer canvas, the size of the snapshot, made once per snapshot and drawn into a rect at a time. */
function layerFor(paint: ShorePaint, zone: ZoneName): ShoreCanvas {
  const known = paint.zoneLayers.get(zone);
  if (known !== undefined) return known;
  const layer = paint.factory.create(paint.canvas.width, paint.canvas.height);
  paint.zoneLayers.set(zone, layer);
  return layer;
}

/** A view rect in the canvas's own pixels, cut to it: `[x, y, width, height]`. */
function canvasRect(paint: ShorePaint, rect: ViewRect): ViewRect | null {
  const { view } = paint;
  const ratio = view.devicePixelRatio;
  const left = Math.max(0, Math.floor((rect[0] + view.widthPx * HALF) * ratio));
  const top = Math.max(0, Math.floor((rect[1] + view.heightPx * HALF) * ratio));
  const right = Math.min(paint.canvas.width, Math.ceil((rect[0] + rect[2] + view.widthPx * HALF) * ratio));
  const bottom = Math.min(paint.canvas.height, Math.ceil((rect[1] + rect[3] + view.heightPx * HALF) * ratio));
  return right > left && bottom > top ? [left, top, right - left, bottom - top] : null;
}

/**
 * The near tile masked by its own far tile (the patch mosaic) over `rect` of the zone's layer (`nearLayer`): only the
 * rect the zone's path lies in is filled, so a narrow band never pays for the whole snapshot.
 */
function nearLayer(paint: ShorePaint, zone: ZoneName, rect: ViewRect): ShoreCanvas {
  const { view } = paint;
  const tiles = SHORE_ZONE_TILES[zone];
  const layer = layerFor(paint, zone);
  const layerPaint: ShorePaint = {
    ...paint,
    canvas: layer,
    context: layer.context,
    patterns: new Map(),
    zoneLayers: new Map(),
  };
  const context = layer.context;
  setCentredPixelTransform(layerPaint);
  const fill = (name: ShoreTileName, tileM: number): void => {
    const pattern = placedPattern(layerPaint, name, {
      tileM: tileM * view.pixelsPerMetre,
      unitPx: view.devicePixelRatio,
    });
    if (pattern === null) return;
    context.fillStyle = pattern;
    context.fillRect(rect[0], rect[1], rect[2], rect[3]);
  };
  // the rect is cleared rather than filled with 'copy': on a CPU canvas 'copy' costs a pass over the whole canvas
  context.clearRect(rect[0], rect[1], rect[2], rect[3]);
  fill(zone, tiles.tileM);
  context.globalCompositeOperation = 'destination-in';
  fill(farName(zone), tiles.tileM * tiles.farScale);
  context.globalCompositeOperation = 'source-over';
  return layer;
}

/** The near layer's rect drawn over the current clip at `alpha`, first cut to `mask`'s shapes when one is given. */
function* drawNearLayer(paint: ShorePaint, zone: ZoneName, look: NearLook): Generator<void, void> {
  const pixels = canvasRect(paint, look.rect);
  if (pixels === null) return;
  const layer = nearLayer(paint, zone, look.rect);
  rasterise(layer);
  yield;
  if (look.mask !== undefined) {
    cutLayer(paint, layer, look.mask);
    rasterise(layer);
    yield;
  }
  const context = paint.context;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = look.alpha;
  const [x, y, width, height] = pixels;
  context.drawImage(layer.image, x, y, width, height, x, y, width, height);
  context.restore();
}

/** Where and how strongly the near layer draws, and the shapes it is cut to instead of a clip. */
export interface NearLook {
  readonly rect: ViewRect;
  readonly alpha: number;
  /** Paths in metres the layer keeps (each filled with its rule, `destination-in`). */
  readonly mask?: (context: ShorePaint['context']) => void;
}

/**
 * Cuts the layer to the mask's shapes. A canvas clip of the zones' long coast paths cost a draw ~100 ms on the CPU
 * canvas; filling the same paths `destination-in` once into the layer costs a few.
 */
function cutLayer(paint: ShorePaint, layer: ShoreCanvas, mask: (context: ShorePaint['context']) => void): void {
  const layerPaint: ShorePaint = { ...paint, canvas: layer, context: layer.context };
  layer.context.save();
  setWorldTransform(layerPaint);
  layer.context.globalCompositeOperation = 'destination-in';
  layer.context.fillStyle = '#fff';
  mask(layer.context);
  layer.context.restore();
}

/** How a zone is filled: its weight, whether close-ups use the near tile, and the world box the path lies in. */
export interface ZoneLook {
  readonly alpha: number;
  readonly isNear: boolean;
  readonly box: WorldBox | null;
  /** Leaves the near tile to the caller (`drawZoneNear`), outside the clip; `zoneFill` answers its strength. */
  readonly isNearLeftOut?: boolean;
}

/** The zone's mean colour far off, and its far tile in the middle distance, over `rect` under the current clip. */
function fillFar(
  paint: ShorePaint,
  zone: ZoneName,
  look: {
    readonly rect: ViewRect;
    readonly alpha: number;
    readonly farWeight: number;
    readonly nearWeight: number;
    readonly averageColour: string;
  },
): void {
  const { context } = paint;
  const { rect, alpha, farWeight, nearWeight } = look;
  const tiles = SHORE_ZONE_TILES[zone];
  if (farWeight < 1) {
    context.save();
    setCentredPixelTransform(paint);
    context.globalAlpha = alpha * (1 - farWeight);
    context.fillStyle = look.averageColour;
    context.fillRect(rect[0], rect[1], rect[2], rect[3]);
    context.restore();
  }
  context.globalAlpha = 1;
  if (farWeight > 0 && nearWeight < 1) {
    fillViewPattern(paint, farName(zone), {
      tileM: tiles.tileM * tiles.farScale,
      alpha: alpha * farWeight * (1 - nearWeight),
      rect,
    });
  }
}

/**
 * The zone's cover inside the current path (`zoneFill`): its mean colour far off, the patchy far tile in the middle
 * distance, and close in the near tile masked by the same patches. Every fill stays inside the box.
 */
export function zoneFill(paint: ShorePaint, zone: ZoneName, look: ZoneLook): number {
  const rect = viewRect(paint, look.box);
  const far = tileOf(paint, farName(zone));
  if (rect === null || far === null) return 0;
  const { context, view } = paint;
  const tiles = SHORE_ZONE_TILES[zone];
  const fade = SHORE_ZONE_FADE;
  const nearWeight = look.isNear
    ? smoothstep(fade.nearFromPx, fade.nearToPx, tiles.tileM * view.screenPixelsPerMetre)
    : 0;
  const farWeight = smoothstep(fade.farFromPx, fade.farToPx, tiles.tileM * tiles.farScale * view.screenPixelsPerMetre);
  context.save();
  context.clip();
  fillFar(paint, zone, { rect, alpha: look.alpha, farWeight, nearWeight, averageColour: far.averageColour });
  const nearAlpha = nearWeight > fade.nearMinWeight ? look.alpha * nearWeight : 0;
  if (nearAlpha > 0 && look.isNearLeftOut !== true) runAll(drawNearLayer(paint, zone, { rect, alpha: nearAlpha }));
  context.restore();
  return look.isNearLeftOut === true ? nearAlpha : 0;
}

/** A zone's near tile drawn outside any clip, cut to `look.mask` (a zone's band): what `isNearLeftOut` left. */
export function drawZoneNear(paint: ShorePaint, zone: ZoneName, look: NearLook): Generator<void, void> {
  return drawNearLayer(paint, zone, look);
}

/** Runs a stepped drawing to its end at once: a boulder's cover, which is small. */
function runAll(steps: Generator<void, void>): void {
  for (let step = steps.next(); step.done !== true; step = steps.next());
}

/** The whole view as a rect, for a view-wide fill. */
export function wholeView(paint: ShorePaint): ViewRect {
  const { view } = paint;
  const bleed = SHORE_LAYER_BLEED_PX;
  return [
    -view.widthPx * HALF - bleed,
    -view.heightPx * HALF - bleed,
    view.widthPx + DIAMETER_PER_RADIUS * bleed,
    view.heightPx + DIAMETER_PER_RADIUS * bleed,
  ];
}
