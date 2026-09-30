// The upgrade popups end to end (docs/testing/tiers-and-builders.md §2.2): real server messages off a real socket,
// through the multiplayer service, `GameStateService` and `UpgradePopupService`, to the popup a player reads over the
// HUD. The trigger, the text and the queue are unit-tested; this pins that a pick the server applies reaches the
// screen, and that a form's popup takes the place of its rung's stage toast (docs/ui/overlays.md §3.6, §3.8).

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  createTestTraitOfferView,
  gameId,
  playerId,
  type GameSnapshot,
  type OwnProgressView,
  type OwnedTrait,
  type TraitId,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { FakeWebSocket } from '../../../testing/fake-websocket';
import { IdentityService } from '../../services/identity.service';
import { MultiplayerService } from '../../services/multiplayer.service';
import { WebSocketService } from '../../services/websocket.service';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';
import { formRealLifeLine } from './format/form-facts';
import { HudComponent } from './hud.component';

const OWN_PLAYER_ID = playerId('player-me');
const START_TICK = 900;
const CILIA: OwnedTrait = { traitId: 'cilia' as TraitId, tier: 1 };
const PARAMECIUM: OwnedTrait = { traitId: 'paramecium_cilia' as TraitId, tier: 1 };
const FORM_OFFER = createTestTraitOfferView({ offerId: 3, cards: [PARAMECIUM], expiresAtTick: START_TICK + 100 });

function snapshotAt(tick: number, ownProgress: Partial<OwnProgressView>): GameSnapshot {
  return createTestSnapshot({
    tick,
    cells: [createTestCellView({ playerId: OWN_PLAYER_ID })],
    players: { [OWN_PLAYER_ID]: { playerId: OWN_PLAYER_ID, playerName: 'Me' } },
    ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, playerName: 'Me', ...ownProgress }),
  });
}

describe('the upgrade popups, end to end', () => {
  let fixture: ComponentFixture<HudComponent>;

  function query(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(testId));
  }

  function receiveSnapshot(tick: number, ownProgress: Partial<OwnProgressView>): void {
    FakeWebSocket.latest().receive(
      JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: snapshotAt(tick, ownProgress) }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({
      imports: [HudComponent],
      providers: [{ provide: IdentityService, useValue: { clientId: 'me' } }],
    });
    TestBed.inject(MultiplayerService);
    TestBed.inject(WebSocketService).connect();
    FakeWebSocket.latest().open();
    fixture = TestBed.createComponent(HudComponent);
    fixture.detectChanges();
    // A eukaryote holding Cilia, with the Paramecium card on offer: the picker is up and no popup yet.
    FakeWebSocket.latest().receive(
      JSON.stringify({
        type: SERVER_MESSAGE_TYPE.gameState,
        gameId: gameId('room'),
        playerId: OWN_PLAYER_ID,
        snapshot: snapshotAt(START_TICK, { stage: CELL_STAGE.eukaryote, ownedTraits: [CILIA], offer: FORM_OFFER }),
        balance: DEFAULT_BALANCE,
        config: createTestSessionConfig(),
        playerIds: [OWN_PLAYER_ID],
        avatarAssignments: { [OWN_PLAYER_ID]: 0 },
      }),
    );
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the form popup with its real-life line once the server applies the pick, and no stage toast', () => {
    expect(query(HUD_TEST_ID.traitOffer)).not.toBeNull();
    expect(query(HUD_TEST_ID.formPopup)).toBeNull();

    receiveSnapshot(START_TICK + 1, { stage: CELL_STAGE.specialised, ownedTraits: [CILIA, PARAMECIUM], offer: null });

    const popup = query(HUD_TEST_ID.formPopup);
    expect(popup?.getAttribute('data-trait-id')).toBe(PARAMECIUM.traitId);
    expect(popup?.textContent).toContain('Paramecium Cilia I');
    expect(popup?.textContent).toContain(formRealLifeLine(PARAMECIUM.traitId));
    expect(query(HUD_TEST_ID.toast)).toBeNull();
  });

  it('shows an upgrade popup for a tier up on the next snapshot', () => {
    receiveSnapshot(START_TICK + 1, { stage: CELL_STAGE.eukaryote, ownedTraits: [{ ...CILIA, tier: 2 }], offer: null });

    const popup = query(HUD_TEST_ID.upgradePopup);
    expect(popup?.getAttribute('data-trait-id')).toBe(CILIA.traitId);
    expect(popup?.textContent).toContain('Cilia Fringe II');
  });
});
