// The sea in a shore snapshot (docs/rendering/opening-dive.md §4, ticket #801, the still half of the mockup's
// `drawShore` sea): the kelp beds and, far out, the bright rim of surf along the coast. The water itself (the deep, the
// shallows' depth ramp, the floor and its caustics) is a function of the distance to the coast, and the shader lays it
// under the snapshot; what moves over it (the swell, ripples, glints and breakers) the shader draws over it
// (`shore-shader-sea.ts`).

import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { SHORE_FAR_SURF } from '../../constants/dive-shore';
import { hexWithAlpha } from '../../colour';
import { smoothstep } from '../../geometry';
import { drawKelpBeds } from './shore-kelp-beds';
import { coastPoints, pxToMetres, ringsPath, seaPath, setWorldTransform, type ShorePaint } from './shore-paint';

/** Far out: a bright rim of surf along the coast (`drawSurf`'s `z > 3.6` branch). */
function drawFarSurf(paint: ShorePaint): void {
  const { view, context } = paint;
  if (view.zoom <= SHORE_FAR_SURF.aboveZoom) return;
  ringsPath(context, coastPoints(paint.coast.rings));
  context.lineWidth = Math.max(pxToMetres(view, SHORE_FAR_SURF.minWidthPx), SHORE_FAR_SURF.widthM);
  const alpha = SHORE_FAR_SURF.alpha * smoothstep(SHORE_FAR_SURF.fadeFromZoom, SHORE_FAR_SURF.fadeToZoom, view.zoom);
  context.strokeStyle = hexWithAlpha(SHORE_PALETTE.foam, alpha);
  context.stroke();
}

/** What of the sea stands still, clipped to the sea: the kelp beds and the far surf. The water is the shader's. */
export function drawSea(paint: ShorePaint): void {
  const { context } = paint;
  context.save();
  setWorldTransform(paint);
  seaPath(paint);
  context.clip('evenodd');
  context.lineJoin = 'round';
  context.lineCap = 'round';
  drawKelpBeds(paint);
  drawFarSurf(paint);
  context.restore();
}
