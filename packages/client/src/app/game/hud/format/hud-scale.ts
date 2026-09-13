// `--hud-scale` (docs/UI.md §1): the unitless number every HUD length is multiplied by. Pure, so
// the rule is tested without a viewport; `hud.component.ts` observes its host and sets the custom
// property from it. There is no `transform: scale`, so hit-testing and focus rings stay in real px.

import {
  HUD_REFERENCE_VIEWPORT_HEIGHT_PX,
  HUD_REFERENCE_VIEWPORT_WIDTH_PX,
  HUD_SCALE_MAX,
  HUD_SCALE_MIN,
} from '../hud-constants';

/**
 * The scale for a viewport: the smaller of the two reference ratios, clamped. The smaller ratio
 * wins so a wide short window scales by its height and the chrome never runs off the bottom.
 * A zero or negative box (a detached element, a test with no layout) answers the floor.
 */
export function hudScaleFor(widthPx: number, heightPx: number): number {
  const widthRatio = widthPx / HUD_REFERENCE_VIEWPORT_WIDTH_PX;
  const heightRatio = heightPx / HUD_REFERENCE_VIEWPORT_HEIGHT_PX;
  const fit = Math.min(widthRatio, heightRatio);
  if (!Number.isFinite(fit)) return HUD_SCALE_MIN;
  return Math.min(HUD_SCALE_MAX, Math.max(HUD_SCALE_MIN, fit));
}
