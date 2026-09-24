// The renderer's crossings (docs/rendering/budget.md §7, docs/architecture/client.md §6): what the HUD hands
// `GameRenderer.render` each frame and what it answers.

import type { TraitId } from '@evolution/shared';
import type { CameraExtent } from './camera';
import type { OwnCellChrome } from './effects/own-cell-indicators-layer';
import type { OwnCellIndicators } from '../state/own-cell-indicators';

export interface RenderInputs {
  readonly previewTraitId: TraitId | null;
  readonly reticle: { readonly isVisible: boolean; readonly x: number; readonly y: number };
  /** The HUD's own-cell record (docs/ui/hud.md §3.1.4): the indicators draw it and the sprint ring reads it; `null` draws none. */
  readonly ownCellIndicators: OwnCellIndicators | null;
  /** How much own-cell chrome to draw; the game's full HUD when absent, the preview lens's `lens` (#505). */
  readonly ownCellChrome?: OwnCellChrome;
}

export interface RenderOutputs {
  readonly cameraExtent: CameraExtent;
  readonly zoom: number;
  readonly visibleCells: number;
  readonly visibleMotes: number;
  readonly fragments: number;
  /** Effect, reticle, own-cell indicator and legibility cue sprites placed this frame (docs/rendering/budget.md §6). */
  readonly effectSprites: number;
}

/** No reticle this frame: the pointer has not been over the canvas, or the HUD hides it (docs/ui/input-and-onboarding.md §5). */
export const NO_RETICLE: RenderInputs['reticle'] = { isVisible: false, x: 0, y: 0 };

/** The crossings with nothing to say: no preview, no reticle, no own-cell record (the bench, a test). */
export const NO_HUD_INPUTS: RenderInputs = { previewTraitId: null, reticle: NO_RETICLE, ownCellIndicators: null };

/** Nothing drawn yet (the first frames had no viewport height, ticket #245): the parked camera's extent, no zoom. */
export function outputsBeforeAnyFrame(extent: CameraExtent): RenderOutputs {
  return { cameraExtent: extent, zoom: 0, visibleCells: 0, visibleMotes: 0, fragments: 0, effectSprites: 0 };
}
