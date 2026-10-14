// The toast row's reach down the screen (docs/ui/overlays.md §3.6): one `body` line on the callout backing,
// `HUD_MARGIN_PX` from the top edge, as `toast.component.ts` draws it while no notice row is up. Pure, so a slot that
// must keep under it (the pinned upgrade popup, §3.8) is tested without a DOM.

import { UI_BODY_LINE_HEIGHT, UI_SPACE_S_PX } from '../../../ui-kit/ui-kit-constants';
import { uiScaleFor } from '../../../ui-kit/format/ui-scale';
import type { ViewportPx } from '../../render/camera';
import { UI_TYPE } from '../../render/constants';
import { HUD_MARGIN_PX } from '../hud-constants';

/** The toast pads its one line by `UI_SPACE_S_PX` above and below. */
const TOAST_PADDED_SIDES = 2;

/** The toast's bottom edge, real px down from the top edge: margin, padding and one line of `body`, scaled. */
export function toastRowBottomPx(viewport: ViewportPx): number {
  const lineHeightPx = UI_TYPE.body.px * UI_BODY_LINE_HEIGHT;
  const unscaledPx = HUD_MARGIN_PX + TOAST_PADDED_SIDES * UI_SPACE_S_PX + lineHeightPx;
  return unscaledPx * uiScaleFor(viewport.width, viewport.height);
}
