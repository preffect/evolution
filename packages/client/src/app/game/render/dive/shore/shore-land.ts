// The land's edge in a shore snapshot (docs/rendering/opening-dive.md §4, ticket #801, the second half of the mockup's
// `drawShore`): the forest's shadow on the upper shore, the bare rock band and its intertidal zones, each reaching up
// the shore a distance that wanders with the rock. A zone's band is its ring and an offset copy (even-odd), built once
// per snapshot and used as a clip, so each layer on it is a plain rect.

import { SHORE_LAND_EDGE, SHORE_ZONE_REACH_M } from '../../constants/dive-shore';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { DIAMETER_PER_RADIUS, HALF } from '../../geometry';
import { COAST_SEGMENT_FLOATS, segmentAt } from './shore-coast';
import { isOutside, segmentBox, unionBox, type MetreBox } from './shore-points';
import { rasterise } from './shore-canvas';
import { valueNoise } from './shore-noise';
import { coastPoints, fillOctaves, pxToMetres, ringsPath, type ShorePaint } from './shore-paint';
import { offsetRings, strokeAlongCoast, type Polyline } from './shore-near-strokes';
import { drawZoneNear, viewRect, zoneFill, type ViewRect, type WorldBox, type ZoneName } from './shore-zone-fill';

type ZoneKey = keyof typeof SHORE_LAND_EDGE.salts;

/** The rings of each zone's offset edge, made once per snapshot. */
type ZoneEdges = Map<ZoneKey, Float64Array[]>;

/** How far up the shore a zone reaches at a point: negative, inland, wandering with two noise octaves (`reach`). */
function reachAt(halfWidthM: number, salt: number): (x: number, y: number) => number {
  const noise = SHORE_LAND_EDGE.reachNoise;
  return (x, y) => {
    const broad = (valueNoise(x / noise.broadM, y / noise.broadM, salt) - HALF) * DIAMETER_PER_RADIUS;
    const fine = (valueNoise(x / noise.fineM, y / noise.fineM, salt + 1) - HALF) * DIAMETER_PER_RADIUS;
    return -halfWidthM * (1 + noise.broadWeight * broad + noise.fineWeight * fine);
  };
}

function zoneEdge(paint: ShorePaint, edges: ZoneEdges, zone: ZoneKey): Float64Array[] {
  const known = edges.get(zone);
  if (known !== undefined) return known;
  const edge = offsetRings(
    paint,
    reachAt(SHORE_ZONE_REACH_M[zone], SHORE_LAND_EDGE.salts[zone]),
    SHORE_LAND_EDGE.offsetWindow,
  );
  edges.set(zone, edge);
  return edge;
}

/** The zone's extent in the view: the coast near it, out to the farthest the zone can reach (`bandBox`). */
function zoneBox(paint: ShorePaint, halfWidthM: number): WorldBox {
  const reach = halfWidthM * SHORE_LAND_EDGE.boxReach;
  const { view, coast } = paint;
  const window = { minX: -view.halfWidthM, minY: -view.halfHeightM, maxX: view.halfWidthM, maxY: view.halfHeightM };
  let near: MetreBox | null = null;
  for (let index = 0; index < coast.segments.length / COAST_SEGMENT_FLOATS; index += 1) {
    const { start, end } = segmentAt(coast.segments, index);
    const box = segmentBox(start, end);
    if (!isOutside(box, window, reach)) near = near === null ? box : unionBox(near, box);
  }
  return near === null ? [0, 0, 0, 0] : [near.minX - reach, near.minY - reach, near.maxX + reach, near.maxY + reach];
}

/**
 * Runs `fill` with the zone's band as the clip and the band's box as the current path (`inBand`); answers the box's
 * rect on the canvas and what `fill` answered, or `null` when the band is off the view.
 */
function inZone<T>(
  paint: ShorePaint,
  edges: ZoneEdges,
  zone: ZoneKey,
  fill: (box: WorldBox) => T,
): { rect: ViewRect; value: T } | null {
  const box = zoneBox(paint, SHORE_ZONE_REACH_M[zone]);
  const rect = viewRect(paint, box);
  if (rect === null) return null;
  const { context, view } = paint;
  context.save();
  ringsPath(context, [...coastPoints(paint.coast.rings), ...zoneEdge(paint, edges, zone)]);
  context.clip('evenodd');
  context.beginPath();
  const scale = view.pixelsPerMetre;
  context.rect(rect[0] / scale, rect[1] / scale, rect[2] / scale, rect[3] / scale);
  const value = fill(box);
  context.restore();
  return { rect, value };
}

/** The forest's shadow on the upper shore, past the rock band. */
function drawForestShadow(paint: ShorePaint, rings: readonly Polyline[]): void {
  for (const shadow of SHORE_LAND_EDGE.forestShadows) {
    strokeAlongCoast(paint, rings, { halfWidthM: SHORE_ZONE_REACH_M.band + shadow.pastBandM, colour: shadow.colour });
  }
}

function drawRockBand(paint: ShorePaint, edges: ZoneEdges): void {
  const { context } = paint;
  inZone(paint, edges, 'band', () => {
    context.fillStyle = SHORE_PALETTE.rockBase;
    context.fill();
    for (const rock of SHORE_LAND_EDGE.rockFills) fillOctaves(paint, 'rock', rock);
  });
  // the forest's edge throws its shade down onto the rock
  const edge = zoneEdge(paint, edges, 'band');
  for (const shade of SHORE_LAND_EDGE.edgeShades)
    strokeAlongCoast(paint, edge, { halfWidthM: shade.halfWidthM, colour: shade.colour });
}

const ZONE_FILLS: readonly { readonly zone: ZoneKey; readonly tiles: ZoneName }[] = [
  { zone: 'barnacle', tiles: 'barnacle' },
  { zone: 'mussel', tiles: 'mussel' },
  { zone: 'rockweed', tiles: 'rockweed' },
  { zone: 'low', tiles: 'lowzone' },
];

/** One zone: its mean colour and far tile under its band's clip, then its near tile cut to the band, unclipped. */
function* drawZone(
  paint: ShorePaint,
  edges: ZoneEdges,
  fill: { readonly zone: ZoneKey; readonly tiles: ZoneName },
): Generator<void, void> {
  const { context } = paint;
  const { zone, tiles } = fill;
  const drawn = inZone(paint, edges, zone, (box) => {
    if (zone === 'barnacle') {
      context.fillStyle = SHORE_LAND_EDGE.barnacleUnder;
      context.fill();
    }
    return zoneFill(paint, tiles, { alpha: SHORE_LAND_EDGE.zoneAlphas[tiles], isNear: true, box, isNearLeftOut: true });
  });
  if (drawn === null || drawn.value <= 0) return;
  const band = [...coastPoints(paint.coast.rings), ...zoneEdge(paint, edges, zone)];
  yield* drawZoneNear(paint, tiles, {
    rect: drawn.rect,
    alpha: drawn.value,
    mask: (layer) => {
      ringsPath(layer, band);
      layer.fill('evenodd');
      ringsPath(layer, coastPoints(paint.coast.rings));
      layer.fill('nonzero');
    },
  });
}

function* drawZones(paint: ShorePaint, edges: ZoneEdges): Generator<void, void> {
  inZone(paint, edges, 'lichen', () => fillOctaves(paint, 'lichenBlack', SHORE_LAND_EDGE.lichen));
  for (const fill of ZONE_FILLS) {
    rasterise(paint.canvas);
    yield;
    yield* drawZone(paint, edges, fill);
  }
}

/** Draws inside the land: what would otherwise paint over the sea. Answers what `draw` answers. */
export function withLandClip<T>(paint: ShorePaint, draw: () => T): T {
  const { context } = paint;
  context.save();
  ringsPath(context, coastPoints(paint.coast.rings));
  context.clip('nonzero');
  const value = draw();
  context.restore();
  return value;
}

/** The forest's shadow and the bare rock band, inside the land; the zones' edges when the band is wide enough. */
function drawUpperEdge(paint: ShorePaint, rings: readonly Polyline[]): ZoneEdges | null {
  drawForestShadow(paint, rings);
  const bandM = SHORE_ZONE_REACH_M.band;
  if (bandM * paint.view.screenPixelsPerMetre < SHORE_LAND_EDGE.simpleUnderPx) {
    const widthM = Math.max(DIAMETER_PER_RADIUS * bandM, pxToMetres(paint.view, SHORE_LAND_EDGE.simpleMinPx));
    strokeAlongCoast(paint, rings, { halfWidthM: widthM * HALF, colour: SHORE_LAND_EDGE.simpleColour });
    return null;
  }
  const edges: ZoneEdges = new Map();
  drawRockBand(paint, edges);
  return edges;
}

/**
 * The land's edge: the forest's shadow and the rock band inside the land, the zones each cut to its band (a zone's
 * band lies inside the land), then the wet waterline inside the land.
 */
export function* drawLandEdge(paint: ShorePaint): Generator<void, void> {
  const rings = coastPoints(paint.coast.rings);
  const edges = withLandClip(paint, () => drawUpperEdge(paint, rings));
  if (edges === null) return;
  rasterise(paint.canvas);
  yield;
  yield* drawZones(paint, edges);
  const wet = SHORE_LAND_EDGE.wetRock;
  withLandClip(paint, () => strokeAlongCoast(paint, rings, { halfWidthM: wet.halfWidthM, colour: wet.colour }));
}
