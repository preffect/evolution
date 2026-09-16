import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ENGULF_PHASE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestTraitOfferView,
  playerId,
  type EngulfPhase,
  type OwnProgressView,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { UI_ALERT_TONE } from '../../../ui-kit/ui-alert-pill.component';
import { ESCAPE_LABEL, ownCellIndicatorsFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import { OVERLAY_ALERT_KIND, overlayAlertFor, type OverlayAlertInput } from './overlay-alert';

const OWN_PLAYER_ID = playerId('player-me');
const SNAPSHOT_TICK = 5000;
const OWN_CELL = createTestCellView({ playerId: OWN_PLAYER_ID });
const OFFER = createTestTraitOfferView({ level: 5, expiresAtTick: SNAPSHOT_TICK + 6.5 * TICK_HZ });

function progressWith(overrides: Partial<OwnProgressView> = {}): OwnProgressView {
  return createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, level: 5, ...overrides });
}

const CALM: OwnCellIndicators = ownCellIndicatorsFor({
  ownCell: OWN_CELL,
  ownProgress: progressWith(),
  balance: DEFAULT_BALANCE,
  threats: [],
  previewTraitId: null,
});

const THREATENED: OwnCellIndicators = {
  ...CALM,
  nearestThreat: { cellId: OWN_CELL.id, label: 'Amoeboid can engulf you' },
};

function engulfedIn(phase: EngulfPhase): OwnCellIndicators {
  return { ...CALM, escape: { progress: 0.5, phase, fill: 0.2, predatorCellId: OWN_CELL.id } };
}

function inputWith(overrides: Partial<OverlayAlertInput> = {}): OverlayAlertInput {
  return {
    indicators: CALM,
    progress: progressWith(),
    balance: DEFAULT_BALANCE,
    serverTick: SNAPSHOT_TICK,
    ...overrides,
  };
}

describe('overlayAlertFor', () => {
  it('is null while nothing is up', () => {
    expect(overlayAlertFor(inputWith())).toBeNull();
  });

  it('carries an open offer as the picker names it: its title, its seconds and its keys, in level gold', () => {
    expect(overlayAlertFor(inputWith({ progress: progressWith({ offer: OFFER }) }))).toEqual({
      kind: OVERLAY_ALERT_KIND.offer,
      text: 'LEVEL 5 · CHOOSE A TRAIT ·',
      figure: '6.5 s',
      tone: UI_ALERT_TONE.gold,
      keyHints: ['1', '2', '3'],
    });
  });

  it('keeps the offer up for a spectator, since the offer outlives the cell', () => {
    const alert = overlayAlertFor(inputWith({ indicators: null, progress: progressWith({ offer: OFFER }) }));
    expect(alert?.kind).toBe(OVERLAY_ALERT_KIND.offer);
  });

  it('shows no offer before the room’s balance arrives, since the countdown reads its choice window', () => {
    expect(overlayAlertFor(inputWith({ balance: null, progress: progressWith({ offer: OFFER }) }))).toBeNull();
  });

  it('puts a threat over an open offer, with the threat label in the danger tone', () => {
    const alert = overlayAlertFor(inputWith({ indicators: THREATENED, progress: progressWith({ offer: OFFER }) }));
    expect(alert).toEqual({
      kind: OVERLAY_ALERT_KIND.threat,
      text: 'Amoeboid can engulf you',
      figure: null,
      tone: UI_ALERT_TONE.danger,
      keyHints: [],
    });
  });

  it('puts an engulf over everything, reading the escape label the renderer draws', () => {
    const cover = overlayAlertFor(inputWith({ indicators: engulfedIn(ENGULF_PHASE.cover) }));
    expect(cover?.kind).toBe(OVERLAY_ALERT_KIND.engulfed);
    expect(cover?.text).toBe(ESCAPE_LABEL.window);
    expect(cover?.tone).toBe(UI_ALERT_TONE.danger);

    const sealed = overlayAlertFor(inputWith({ indicators: engulfedIn(ENGULF_PHASE.absorb) }));
    expect(sealed?.text).toBe(ESCAPE_LABEL.sealed);
  });
});
