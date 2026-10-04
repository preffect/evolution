// A radial gradient laid round a shape by its radius (docs/rendering/opening-dive.md §4): Canvas 2D's two circles,
// each placed and sized in radii of the shape — the light's circle and the far one. The shore's boulders and the
// slime's glass bodies (ticket #803) are lit this way, as the mockup lit them.

import type { BakeGradient } from '../../textures/texture-bake';
import type { ShoreContext2D } from './shore-canvas';

/** The two circles in radii of the shape: the first's centre and radius, then the second's. */
export interface GradientCircles {
  readonly fromX: number;
  readonly fromY: number;
  readonly fromRadius: number;
  readonly toX: number;
  readonly toY: number;
  readonly toRadius: number;
}

/** The radial gradient from `circles.from…` to `circles.to…`, in radii of the shape at `centre`. */
export function radiiGradient(
  context: ShoreContext2D,
  centre: { readonly x: number; readonly y: number; readonly radius: number },
  circles: GradientCircles,
): BakeGradient {
  const { x, y, radius } = centre;
  return context.createRadialGradient(
    x + radius * circles.fromX,
    y + radius * circles.fromY,
    radius * circles.fromRadius,
    x + radius * circles.toX,
    y + radius * circles.toY,
    radius * circles.toRadius,
  );
}
