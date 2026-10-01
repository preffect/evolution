// The shore's round shapes (docs/rendering/opening-dive.md §4, ticket #801): a smooth closed blob through jittered
// points, as the mockup draws its tide pools (`poolShape`) and its stones (`rockPath`): quadratic curves through the
// midpoints of a ring of points, so the outline has no corners.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SHORE_ROCK_SHAPE } from '../../constants/dive-shore-boulders';
import { SHORE_POOL_SHAPE } from '../../constants/dive-shore-objects';
import { HALF } from '../../geometry';
import type { ShoreContext2D } from './shore-canvas';
import { coordinateHash } from './shore-noise';

/** A blob's place: its centre, radius, seed and vertical squash. */
export interface BlobPlace {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly seed: number;
  readonly squash: number;
}

/** The smooth closed path through `points` (quadratic curves through their midpoints). */
function smoothClosedPath(context: ShoreContext2D, points: readonly (readonly [number, number])[]): void {
  context.beginPath();
  const count = points.length;
  for (let index = 0; index < count; index += 1) {
    const [x, y] = points[index] ?? [0, 0];
    const [nextX, nextY] = points[(index + 1) % count] ?? [0, 0];
    const midX = (x + nextX) * HALF;
    const midY = (y + nextY) * HALF;
    if (index === 0) context.moveTo(midX, midY);
    else context.quadraticCurveTo(x, y, midX, midY);
  }
  const [firstX, firstY] = points[0] ?? [0, 0];
  const [secondX, secondY] = points[1] ?? [0, 0];
  context.quadraticCurveTo(firstX, firstY, (firstX + secondX) * HALF, (firstY + secondY) * HALF);
  context.closePath();
}

/** A tide pool's outline (`poolShape`). */
export function poolPath(context: ShoreContext2D, place: BlobPlace): void {
  const shape = SHORE_POOL_SHAPE;
  const points = Array.from({ length: shape.points }, (_unused, index): [number, number] => {
    const angle = (index / shape.points) * RADIANS_PER_FULL_TURN;
    const radius =
      place.radius * (shape.radius.min + shape.radius.span * coordinateHash(place.seed, index, shape.salt));
    return [place.x + Math.cos(angle) * radius, place.y + Math.sin(angle) * radius * place.squash];
  });
  smoothClosedPath(context, points);
}

/** A stone's outline: lobes two points wide and a little wobble (`rockPath`). */
export function rockPath(context: ShoreContext2D, place: BlobPlace): void {
  const shape = SHORE_ROCK_SHAPE;
  const points = Array.from({ length: shape.points }, (_unused, index): [number, number] => {
    const angle = (index / shape.points) * RADIANS_PER_FULL_TURN;
    const lobe = Math.floor(index / shape.pointsPerLobe);
    const big = coordinateHash(place.seed, lobe, shape.lobeSalt);
    const next = coordinateHash(place.seed, lobe + 1, shape.lobeSalt);
    const between = (index % shape.pointsPerLobe) / shape.pointsPerLobe;
    const wobble = shape.wobble * (coordinateHash(place.seed, index, shape.wobbleSalt) - HALF);
    const radius = place.radius * (shape.base + shape.lobe * (big + (next - big) * between) + wobble);
    return [place.x + Math.cos(angle) * radius, place.y + Math.sin(angle) * radius * place.squash];
  });
  smoothClosedPath(context, points);
}
