// `--ui-scale` (docs/ui/layout.md §1, docs/ui/components-and-constants.md §10.1): the unitless number every kit and
// HUD length is multiplied by. Pure, so the rule is tested without a viewport; a `[uiSurface]` (and, until
// the HUD moves onto the kit, `hud.component.ts` for `--hud-scale`) observes its host and sets the custom
// property from it. There is no `transform: scale`, so hit-testing and focus rings stay in real px.

import {
  UI_REFERENCE_VIEWPORT_HEIGHT_PX,
  UI_REFERENCE_VIEWPORT_WIDTH_PX,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
} from '../ui-kit-constants';

/**
 * The scale for a viewport: the smaller of the two reference ratios, clamped. The smaller ratio
 * wins so a wide short window scales by its height and the chrome never runs off the bottom.
 * A zero or negative box (a detached element, a test with no layout) answers the floor.
 */
export function uiScaleFor(widthPx: number, heightPx: number): number {
  const widthRatio = widthPx / UI_REFERENCE_VIEWPORT_WIDTH_PX;
  const heightRatio = heightPx / UI_REFERENCE_VIEWPORT_HEIGHT_PX;
  const fit = Math.min(widthRatio, heightRatio);
  if (!Number.isFinite(fit)) return UI_SCALE_MIN;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, fit));
}
