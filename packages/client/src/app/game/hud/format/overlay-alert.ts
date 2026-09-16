// The alert strip (docs/ui/encyclopedia.md §11.1): the one fact a modal overlay must not hide, in priority order — the
// own cell being engulfed, then a cell on screen that can engulf it, then an open trait offer. Its words are the
// HUD's own: the escape label the renderer draws over the escape arc, the threat label on the warning ring, and the
// picker's title and countdown, so nothing here is a second copy of a sentence. `null` when nothing is up. Pure.

import type { BalanceConfig, PlayerProgressView, ValueOf } from '@evolution/shared';
import { UI_ALERT_TONE, type UiAlertTone } from '../../../ui-kit/ui-alert-pill.component';
import { escapeLabelFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import { traitOfferViewFor } from './trait-cards';

/** `data-alert-kind`, in priority order. */
export const OVERLAY_ALERT_KIND = { engulfed: 'engulfed', threat: 'threat', offer: 'offer' } as const;
export type OverlayAlertKind = ValueOf<typeof OVERLAY_ALERT_KIND>;

export interface OverlayAlert {
  readonly kind: OverlayAlertKind;
  /** Uppercased by the pill's `label` role, not here. */
  readonly text: string;
  /** The changing number after the text (`6.5 s`), or `null`. */
  readonly figure: string | null;
  readonly tone: UiAlertTone;
  /** Keys shown at the strip's trailing end: the offer's `1` `2` `3`. */
  readonly keyHints: readonly string[];
}

export interface OverlayAlertInput {
  /** `null` while spectating: no own cell, so nothing to engulf or threaten. */
  readonly indicators: OwnCellIndicators | null;
  readonly progress: PlayerProgressView | null;
  readonly balance: BalanceConfig | null;
  /** The newest snapshot's tick, the offer countdown's clock. */
  readonly serverTick: number | null;
}

/** Between the picker's title and its seconds, as the mockups draw the strip (`LEVEL 5 · CHOOSE A TRAIT · 6.5 s`). */
const FIGURE_SEPARATOR = ' ·';
const NO_KEY_HINTS: readonly string[] = [];

function dangerAlert(kind: OverlayAlertKind, text: string): OverlayAlert {
  return { kind, text, figure: null, tone: UI_ALERT_TONE.danger, keyHints: NO_KEY_HINTS };
}

/** The open offer as the picker names it; it outlives the cell, so a spectator sees it too (docs/ui/overlays.md §3.3). */
function offerAlertFor(input: OverlayAlertInput): OverlayAlert | null {
  const { progress, balance } = input;
  const offer = progress?.offer ?? null;
  if (progress === null || offer === null || balance === null) return null;
  const view = traitOfferViewFor({ offer, progress, serverTick: input.serverTick ?? offer.expiresAtTick, balance });
  return {
    kind: OVERLAY_ALERT_KIND.offer,
    text: `${view.title}${FIGURE_SEPARATOR}`,
    figure: view.secondsText,
    tone: UI_ALERT_TONE.gold,
    keyHints: view.cards.map((card) => card.keyLabel),
  };
}

export function overlayAlertFor(input: OverlayAlertInput): OverlayAlert | null {
  const escape = input.indicators?.escape ?? null;
  if (escape !== null) return dangerAlert(OVERLAY_ALERT_KIND.engulfed, escapeLabelFor(escape));
  const threat = input.indicators?.nearestThreat ?? null;
  if (threat !== null) return dangerAlert(OVERLAY_ALERT_KIND.threat, threat.label);
  return offerAlertFor(input);
}
