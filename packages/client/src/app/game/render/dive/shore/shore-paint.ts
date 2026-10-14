// What a shore snapshot is drawn with (docs/rendering/opening-dive.md §4, ticket #801): its view in metres round the
// focus, the canvas, the coast built for it and the tiles, plus the mockup's pattern helpers (`patXf`, `trueStyle`,
// `octaves`, `viewPat`): a tile laid down at its true size in the world, its mean colour once it shrinks below a few
// pixels, and the self-similar tiles at two neighbouring octaves whose weights follow the zoom, so they never pop.

import { SHORE_OCTAVE, SHORE_PATTERN_SHRINK_BELOW, SHORE_TRUE_TILE_PX } from '../../constants/dive-shore';
import { DIAMETER_PER_RADIUS, HALF, smoothstep } from '../../geometry';
import type { ShoreCanvas, ShoreCanvasFactory, ShoreContext2D, ShorePattern } from './shore-canvas';
import type { CoastRing, ShoreCoast } from './shore-coast';
import { pointCount, pointX, pointY, type FlatPoints } from './shore-points';
import type { ShoreTile, ShoreTileName, ShoreTileSource } from './shore-tiles';

/** The view a snapshot draws: the mockup's `z`, `s`, `cw`, `ch`, `dpr`, `hx`, `hy` and `T`. */
export interface ShoreView {
  /** log10 of the view's width in metres: what the fades and the detail switches read. */
  readonly zoom: number;
  /** The snapshot's CSS px per metre: what it is drawn at, the scale of the finest view it serves. */
  readonly pixelsPerMetre: number;
  /**
   * The screen's CSS px per metre at the level's own zoom: what every size on screen is judged by (a line a pixel
   * wide, a tile big enough to read), so the snapshot is the mockup's frame at that zoom, drawn finer.
   */
  readonly screenPixelsPerMetre: number;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Canvas px per CSS px. */
  readonly devicePixelRatio: number;
  readonly halfWidthM: number;
  readonly halfHeightM: number;
  /** The ambient clock the still parts are drawn at. */
  readonly timeSeconds: number;
}

export interface ShorePaint {
  readonly view: ShoreView;
  readonly canvas: ShoreCanvas;
  readonly context: ShoreContext2D;
  readonly coast: ShoreCoast;
  readonly tiles: ShoreTileSource;
  readonly factory: ShoreCanvasFactory;
  /** Patterns made on this canvas, by tile and size (`rock:380`). */
  readonly patterns: Map<string, ShorePattern>;
  /** Each zone's near tile masked by its far tile, made once per snapshot (`shore-zone-fill.ts`). */
  readonly zoneLayers: Map<string, ShoreCanvas>;
}

/** `n` screen px in metres (`px`). */
export function pxToMetres(view: ShoreView, pixels: number): number {
  return pixels / view.screenPixelsPerMetre;
}

/** Whether a disc of radius `reach` round `(x, y)` touches the view (`vis`). */
export function isInView(view: ShoreView, point: { readonly x: number; readonly y: number }, reach: number): boolean {
  return (
    point.x + reach > -view.halfWidthM &&
    point.x - reach < view.halfWidthM &&
    point.y + reach > -view.halfHeightM &&
    point.y - reach < view.halfHeightM
  );
}

/** Metres round the focus to the canvas (`worldXf`). */
export function setWorldTransform(paint: ShorePaint): void {
  const { view } = paint;
  const scale = view.devicePixelRatio * view.pixelsPerMetre;
  paint.context.setTransform(
    scale,
    0,
    0,
    scale,
    view.devicePixelRatio * view.widthPx * HALF,
    view.devicePixelRatio * view.heightPx * HALF,
  );
}

/** CSS px from the view's centre to the canvas: what view-wide fills draw in. */
export function setCentredPixelTransform(paint: ShorePaint): void {
  const { view } = paint;
  const ratio = view.devicePixelRatio;
  paint.context.setTransform(ratio, 0, 0, ratio, ratio * view.widthPx * HALF, ratio * view.heightPx * HALF);
}

export function tileOf(paint: ShorePaint, name: ShoreTileName): ShoreTile | null {
  return paint.tiles.get(name);
}

/**
 * The tile `sizePx` across, as a pattern on this canvas, made once a snapshot. A tile drawn much smaller than it was
 * baked is shrunk first, smoothly, so a pattern fill samples it one to one: filling with a large tile shrunk on the
 * fly cost the CPU canvas tens of milliseconds a fill, and shimmered.
 */
function patternAt(paint: ShorePaint, tile: ShoreTile, name: ShoreTileName, sizePx: number): ShorePattern | null {
  const key = `${name}:${sizePx}`;
  const known = paint.patterns.get(key);
  if (known !== undefined) return known;
  let image = tile.canvas.image;
  if (sizePx !== tile.sizePx) {
    const shrunk = paint.factory.create(sizePx, sizePx);
    shrunk.context.imageSmoothingQuality = 'high';
    shrunk.context.drawImage(tile.canvas.image, 0, 0, sizePx, sizePx);
    image = shrunk.image;
  }
  const pattern = paint.context.createPattern(image, 'repeat');
  if (pattern !== null) paint.patterns.set(key, pattern);
  return pattern;
}

/** Canvas px per metre under the world transform (`setWorldTransform`). */
export function worldUnitPx(view: ShoreView): number {
  return view.devicePixelRatio * view.pixelsPerMetre;
}

/**
 * A pattern placement: the tile spans `tileM` of whatever the context draws in (`unitPx` canvas px each: metres under
 * the world transform by default), turned by `turn`, offset.
 */
export interface PatternPlacement {
  readonly tileM: number;
  readonly turn?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly unitPx?: number;
}

/** The size a tile is used at on the canvas: shrunk to whole pixels when it is drawn well under its baked size. */
function usedSizePx(tile: ShoreTile, tileCanvasPx: number): number {
  return tileCanvasPx < tile.sizePx * SHORE_PATTERN_SHRINK_BELOW ? Math.max(1, Math.round(tileCanvasPx)) : tile.sizePx;
}

/** The tile's pattern laid down at `placement` (`patXf`). */
export function placedPattern(
  paint: ShorePaint,
  name: ShoreTileName,
  placement: PatternPlacement,
): ShorePattern | null {
  const tile = tileOf(paint, name);
  if (tile === null) return null;
  const sizePx = usedSizePx(tile, placement.tileM * (placement.unitPx ?? worldUnitPx(paint.view)));
  const pattern = patternAt(paint, tile, name, sizePx);
  if (pattern === null) return null;
  const scale = placement.tileM / sizePx;
  const turn = placement.turn ?? 0;
  const cosine = Math.cos(turn) * scale;
  const sine = Math.sin(turn) * scale;
  pattern.setTransform({
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: placement.offsetX ?? 0,
    f: placement.offsetY ?? 0,
  });
  return pattern;
}

/** How far a true-size tile has come up from its mean colour: 0 under 40 px on screen, 1 over 90 (`trueStyle`). */
export function trueTileWeight(pixelsPerMetre: number, tileM: number): number {
  return smoothstep(SHORE_TRUE_TILE_PX.from, SHORE_TRUE_TILE_PX.to, tileM * pixelsPerMetre);
}

/** Paints the current path with a true-size tile: its mean colour fading into its pattern (`fillTrue` / `strokeTrue`). */
export function paintTrue(
  paint: ShorePaint,
  name: ShoreTileName,
  look: { readonly tileM: number; readonly alpha: number; readonly isStroke: boolean; readonly rule?: CanvasFillRule },
): void {
  const tile = tileOf(paint, name);
  if (tile === null) return;
  const weight = trueTileWeight(paint.view.screenPixelsPerMetre, look.tileM);
  const context = paint.context;
  const apply = (style: string | ShorePattern): void => {
    if (look.isStroke) {
      context.strokeStyle = style;
      context.stroke();
    } else {
      context.fillStyle = style;
      context.fill(look.rule);
    }
  };
  if (weight < 1) {
    context.globalAlpha = look.alpha * (1 - weight);
    apply(tile.averageColour);
  }
  const pattern = weight > 0 ? placedPattern(paint, name, { tileM: look.tileM }) : null;
  if (pattern !== null) {
    context.globalAlpha = look.alpha * weight;
    apply(pattern);
  }
  context.globalAlpha = 1;
}

/**
 * A self-similar tile at two neighbouring octaves (ratio 4) whose weights follow the zoom (`octaves`): `draw(tileM,
 * weight)` paints one octave; the tile comes to about `targetPx` on screen.
 */
export function eachOctave(
  view: ShoreView,
  base: { readonly tileM: number; readonly targetPx: number },
  draw: (tileM: number, weight: number) => void,
): void {
  const level = Math.log((view.screenPixelsPerMetre * base.tileM) / base.targetPx) / Math.log(SHORE_OCTAVE.ratio);
  const whole = Math.floor(level);
  draw(base.tileM / SHORE_OCTAVE.ratio ** whole, 1);
  draw(base.tileM / SHORE_OCTAVE.ratio ** (whole + 1), smoothstep(0, 1, level - whole));
}

/** Fills the current path with a self-similar tile at two octaves (`fillOct`). */
export function fillOctaves(
  paint: ShorePaint,
  name: ShoreTileName,
  look: { readonly tileM: number; readonly alpha: number; readonly targetPx?: number; readonly turn?: number },
): void {
  const context = paint.context;
  eachOctave(paint.view, { tileM: look.tileM, targetPx: look.targetPx ?? SHORE_OCTAVE.targetPx }, (tileM, weight) => {
    const pattern = placedPattern(paint, name, { tileM, turn: look.turn });
    if (pattern === null) return;
    context.globalAlpha = look.alpha * weight;
    context.fillStyle = pattern;
    context.fill();
  });
  context.globalAlpha = 1;
}

/** Strokes the current path with a self-similar tile at two octaves (`strokeOct`). */
export function strokeOctaves(
  paint: ShorePaint,
  name: ShoreTileName,
  look: { readonly tileM: number; readonly alpha: number; readonly width: number },
): void {
  const context = paint.context;
  context.lineWidth = look.width;
  eachOctave(paint.view, { tileM: look.tileM, targetPx: SHORE_OCTAVE.targetPx }, (tileM, weight) => {
    const pattern = placedPattern(paint, name, { tileM });
    if (pattern === null) return;
    context.globalAlpha = look.alpha * weight;
    context.strokeStyle = pattern;
    context.stroke();
  });
  context.globalAlpha = 1;
}

/** The rings as one path (`ringsPath`). */
export function ringsPath(context: ShoreContext2D, rings: readonly FlatPoints[]): void {
  context.beginPath();
  for (const points of rings) {
    context.moveTo(pointX(points, 0), pointY(points, 0));
    for (let index = 1; index < pointCount(points); index += 1)
      context.lineTo(pointX(points, index), pointY(points, index));
    context.closePath();
  }
}

export function coastPoints(rings: readonly CoastRing[]): (readonly number[])[] {
  return rings.map((ring) => ring.points);
}

/** The sea: the view and its margin less the land (`seaPath`, filled or clipped even-odd). */
export function seaPath(paint: ShorePaint): void {
  const { view, coast, context } = paint;
  const margin = coast.marginM;
  ringsPath(context, coastPoints(coast.rings));
  context.rect(
    -view.halfWidthM - margin,
    -view.halfHeightM - margin,
    DIAMETER_PER_RADIUS * (view.halfWidthM + margin),
    DIAMETER_PER_RADIUS * (view.halfHeightM + margin),
  );
}
