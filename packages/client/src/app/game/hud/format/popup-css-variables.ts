// The upgrade, form and giant popups' custom properties (docs/ui/overlays.md §3.8): one part of the HUD's list
// (`hud-css-variables.ts`, which says why the list exists), in a file of its own so that one stays under the size limit.

import { MILLISECONDS_PER_SECOND } from '@evolution/shared';
import { RESPAWN_TEXT_TOP_PX } from '../hud-constants';
import {
  FORM_POPUP_DURATION_SECONDS,
  FORM_POPUP_FROM_SCALE,
  FORM_POPUP_GLOW_FLARE,
  FORM_POPUP_GLOW_PX,
  FORM_POPUP_IN_MS,
  FORM_POPUP_MAX_WIDTH_PX,
  FORM_POPUP_OUT_MS,
  FORM_POPUP_OVERSHOOT_SCALE,
  FORM_POPUP_RIM_PX,
  FORM_POPUP_RING_MS,
  FORM_POPUP_RING_SCALE,
  FORM_POPUP_SETTLE_MS,
  FORM_POPUP_TITLE_SCALE,
  RESPAWN_TEXT_HEIGHT_PX,
  UPGRADE_POPUP_DEATH_TEXT_GAP_PX,
  UPGRADE_POPUP_DURATION_SECONDS,
  UPGRADE_POPUP_FROM_SCALE,
  UPGRADE_POPUP_IN_MS,
  UPGRADE_POPUP_MAX_WIDTH_PX,
  UPGRADE_POPUP_MOVE_FADE_IN_MS,
  UPGRADE_POPUP_MOVE_FADE_OUT_MS,
  UPGRADE_POPUP_OUT_MS,
  UPGRADE_POPUP_RISE_PX,
} from '../upgrade-popup-constants';

/**
 * The upgrade and form popups (docs/ui/overlays.md §3.8). Each life is published whole, so a stylesheet starts the
 * fade at `life − out` and the element has faded by the tick the service takes it down.
 */
export function popupStyleVariables(): Readonly<Record<string, string>> {
  return {
    '--hud-upgrade-popup-life': `${UPGRADE_POPUP_DURATION_SECONDS * MILLISECONDS_PER_SECOND}ms`,
    '--hud-upgrade-popup-in': `${UPGRADE_POPUP_IN_MS}ms`,
    '--hud-upgrade-popup-out': `${UPGRADE_POPUP_OUT_MS}ms`,
    '--hud-upgrade-popup-rise': `${UPGRADE_POPUP_RISE_PX}px`,
    '--hud-upgrade-popup-from-scale': String(UPGRADE_POPUP_FROM_SCALE),
    '--hud-upgrade-popup-max-width': `${UPGRADE_POPUP_MAX_WIDTH_PX}px`,
    '--hud-upgrade-popup-move-fade-in': `${UPGRADE_POPUP_MOVE_FADE_IN_MS}ms`,
    '--hud-upgrade-popup-move-fade-out': `${UPGRADE_POPUP_MOVE_FADE_OUT_MS}ms`,
    '--hud-form-popup-life': `${FORM_POPUP_DURATION_SECONDS * MILLISECONDS_PER_SECOND}ms`,
    '--hud-form-popup-in': `${FORM_POPUP_IN_MS}ms`,
    '--hud-form-popup-settle': `${FORM_POPUP_SETTLE_MS}ms`,
    '--hud-form-popup-out': `${FORM_POPUP_OUT_MS}ms`,
    '--hud-form-popup-from-scale': String(FORM_POPUP_FROM_SCALE),
    '--hud-form-popup-overshoot-scale': String(FORM_POPUP_OVERSHOOT_SCALE),
    '--hud-form-popup-max-width': `${FORM_POPUP_MAX_WIDTH_PX}px`,
    '--hud-form-popup-glow': `${FORM_POPUP_GLOW_PX}px`,
    '--hud-form-popup-glow-flare': String(FORM_POPUP_GLOW_FLARE),
    '--hud-form-popup-rim': `${FORM_POPUP_RIM_PX}px`,
    '--hud-form-popup-title-scale': String(FORM_POPUP_TITLE_SCALE),
    '--hud-form-popup-ring': `${FORM_POPUP_RING_MS}ms`,
    '--hud-form-popup-ring-scale': String(FORM_POPUP_RING_SCALE),
    '--hud-popup-death-text-bottom': `${RESPAWN_TEXT_TOP_PX + RESPAWN_TEXT_HEIGHT_PX + UPGRADE_POPUP_DEATH_TEXT_GAP_PX}px`,
  };
}
