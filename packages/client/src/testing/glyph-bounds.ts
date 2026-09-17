// How far from the medallion's centre a glyph's layer reaches (docs/visual-style/ui-type.md §7.2), for the specs that
// hold a glyph inside its frame. A glyph that draws past the rim smears over whatever panel is behind it, and the list
// LOD enlarges the glyph inside that frame, so the drawing has to fit with room to spare. Walking the path is the only
// way to know: the tables hand-write path data, so no bounding box exists until something reads the commands. Pure.

import { GLYPH_CENTRE } from '../app/game/render/constants/trait-glyph-layers';
import { shapePathData } from '../app/game/glyphs/glyph-view';
import type { GlyphLayer } from '../app/game/render/svg-glyph';

/** Every SVG path command letter, and how many numbers one of its argument sets takes. */
const ARGUMENT_COUNT: Readonly<Record<string, number>> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};
/** Which numbers of one argument set are a point, as (x, y) index pairs: an arc's seven end in its endpoint. */
const POINT_INDICES: Readonly<Record<string, readonly number[]>> = {
  m: [0],
  l: [0],
  c: [0, 2, 4],
  s: [0, 2],
  q: [0, 2],
  t: [0],
  a: [5],
};
const NUMBER_TOKEN = /^-?\d*\.?\d+(?:e[-+]?\d+)?$/i;
const PATH_TOKEN = /[astvzqmhlc]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

interface Cursor {
  x: number;
  y: number;
}

/** One argument set of a command, applied to the cursor; returns the points it puts on the page. */
function pointsOfArguments(
  command: string,
  args: readonly number[],
  cursor: Cursor,
): readonly (readonly [number, number])[] {
  const letter = command.toLowerCase();
  const isRelative = command === letter;
  const originX = isRelative ? cursor.x : 0;
  const originY = isRelative ? cursor.y : 0;
  if (letter === 'h') {
    cursor.x = originX + args[0]!;
    return [[cursor.x, cursor.y]];
  }
  if (letter === 'v') {
    cursor.y = originY + args[0]!;
    return [[cursor.x, cursor.y]];
  }
  const points = (POINT_INDICES[letter] ?? []).map((index): readonly [number, number] => [
    originX + args[index]!,
    originY + args[index + 1]!,
  ]);
  const last = points[points.length - 1];
  if (last !== undefined) {
    cursor.x = last[0];
    cursor.y = last[1];
  }
  return points;
}

/** Every point an SVG path puts on the page, control points included: a conservative outline of what it draws. */
export function pathPoints(pathData: string): readonly (readonly [number, number])[] {
  const tokens = pathData.match(PATH_TOKEN) ?? [];
  const cursor: Cursor = { x: 0, y: 0 };
  const points: (readonly [number, number])[] = [];
  let command = 'M';
  let pending: number[] = [];
  const flush = (): void => {
    const size = ARGUMENT_COUNT[command.toLowerCase()] ?? 0;
    while (size > 0 && pending.length >= size) {
      points.push(...pointsOfArguments(command, pending.slice(0, size), cursor));
      pending = pending.slice(size);
    }
  };
  for (const token of tokens) {
    if (NUMBER_TOKEN.test(token)) {
      pending.push(Number(token));
      continue;
    }
    flush();
    command = token;
    pending = [];
  }
  flush();
  return points;
}

/** How far the layer's drawing reaches from the medallion's centre, its offset and its stroke's half width included. */
export function layerReach(layer: GlyphLayer): number {
  const halfStroke = (layer.stroke?.width ?? 0) / 2;
  const offsetX = layer.offset?.x ?? 0;
  const offsetY = layer.offset?.y ?? 0;
  const distances = pathPoints(shapePathData(layer.shape)).map(([x, y]) =>
    Math.hypot(x + offsetX - GLYPH_CENTRE, y + offsetY - GLYPH_CENTRE),
  );
  return Math.max(0, ...distances) + halfStroke;
}
