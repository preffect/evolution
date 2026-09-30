import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSnapshot,
  gameId,
  playerId,
  type OwnedTrait,
  type PlayerLifeState,
  type TraitId,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { paletteFor } from '../render/palette';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';
import { formRealLifeLine } from './format/form-facts';
import { FORM_POPUP_KICKER_TEXT, UPGRADE_POPUP_PLACEMENT } from './format/upgrade-popups';
import { FORM_POPUP_DURATION_SECONDS, UPGRADE_POPUP_DURATION_SECONDS } from './upgrade-popup-constants';
import { UpgradePopupComponent } from './upgrade-popup.component';

const OWN_PLAYER_ID = playerId('player-me');
const OWN_AVATAR_INDEX = 3;
const START_TICK = 600;
const UPGRADE_TICKS = UPGRADE_POPUP_DURATION_SECONDS * TICK_HZ;
const FORM_TICKS = FORM_POPUP_DURATION_SECONDS * TICK_HZ;
const FLAGELLUM: OwnedTrait = { traitId: 'simple_flagellum' as TraitId, tier: 1 };
const CILIA: OwnedTrait = { traitId: 'cilia' as TraitId, tier: 1 };
const PARAMECIUM: OwnedTrait = { traitId: 'paramecium_cilia' as TraitId, tier: 1 };

describe('UpgradePopupComponent (docs/ui/overlays.md §3.8)', () => {
  let fixture: ComponentFixture<UpgradePopupComponent>;
  let multiplayer: MultiplayerService;

  function receive(
    tick: number,
    ownedTraits: OwnedTrait[],
    lifeState: PlayerLifeState = PLAYER_LIFE_STATE.alive,
  ): void {
    const ownProgress = createTestPlayerProgressView({
      playerId: OWN_PLAYER_ID,
      stage: CELL_STAGE.eukaryote,
      ownedTraits,
      lifeState,
    });
    multiplayer.snapshot.set(createTestSnapshot({ tick, ownProgress }));
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function popup(testId: string): HTMLElement | null {
    return host().querySelector(testIdSelector(testId));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [UpgradePopupComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.gameId.set(gameId('game-1'));
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.avatarAssignments.set({ [OWN_PLAYER_ID]: OWN_AVATAR_INDEX });
    fixture = TestBed.createComponent(UpgradePopupComponent);
    receive(START_TICK, []);
  });

  it('shows nothing until a trait is gained, inside a polite live region', () => {
    expect(popup(HUD_TEST_ID.upgradePopup)).toBeNull();
    expect(host().querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows the trait’s name, tier and toned effect lines, and takes it down after its duration', () => {
    const gainTick = START_TICK + 1;
    receive(gainTick, [FLAGELLUM]);
    const shown = popup(HUD_TEST_ID.upgradePopup);
    expect(shown?.getAttribute('data-trait-id')).toBe(FLAGELLUM.traitId);
    expect(shown?.querySelector('.title')?.textContent?.trim()).toBe('Simple Flagellum I');
    const effects = shown?.querySelectorAll('.effect') ?? [];
    expect(effects.length).toBeGreaterThan(0);
    expect(shown?.querySelectorAll('ui-effect-mark[data-effect]').length).toBe(effects.length);
    expect(shown?.querySelector('.real-life')).toBeNull();
    expect(shown?.querySelector('.kicker')).toBeNull();

    receive(gainTick + UPGRADE_TICKS - 1, [FLAGELLUM]);
    expect(popup(HUD_TEST_ID.upgradePopup)).not.toBeNull();
    receive(gainTick + UPGRADE_TICKS, [FLAGELLUM]);
    expect(popup(HUD_TEST_ID.upgradePopup)).toBeNull();
  });

  it('queues two picks close together: one at a time, the second when the first ends, never both', () => {
    const firstTick = START_TICK + 1;
    receive(firstTick, [FLAGELLUM]);
    receive(firstTick + 1, [FLAGELLUM, CILIA]);
    expect(host().querySelectorAll('.popup')).toHaveLength(1);
    expect(popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(FLAGELLUM.traitId);

    const secondStart = firstTick + UPGRADE_TICKS;
    receive(secondStart, [FLAGELLUM, CILIA]);
    expect(host().querySelectorAll('.popup')).toHaveLength(1);
    expect(popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(CILIA.traitId);
    receive(secondStart + UPGRADE_TICKS, [FLAGELLUM, CILIA]);
    expect(host().querySelector('.popup')).toBeNull();
  });

  it('shows the form popup with its real-life line in the seat colour, for the form’s longer life', () => {
    receive(START_TICK + 1, [CILIA]);
    receive(START_TICK + 1 + UPGRADE_TICKS, [CILIA]);
    const gainTick = START_TICK + 1 + UPGRADE_TICKS + 1;
    receive(gainTick, [CILIA, PARAMECIUM]);
    const shown = popup(HUD_TEST_ID.formPopup);
    expect(popup(HUD_TEST_ID.upgradePopup)).toBeNull();
    expect(shown?.querySelector('.kicker')?.textContent?.trim()).toBe(FORM_POPUP_KICKER_TEXT);
    expect(shown?.querySelector('.title')?.textContent?.trim()).toBe('Paramecium Cilia I');
    expect(shown?.querySelector('.real-life')?.textContent?.trim()).toBe(formRealLifeLine(PARAMECIUM.traitId));
    expect(host().style.getPropertyValue('--popup-seat-colour')).toBe(paletteFor(OWN_AVATAR_INDEX).rim);

    receive(gainTick + UPGRADE_TICKS, [CILIA, PARAMECIUM]);
    expect(popup(HUD_TEST_ID.formPopup)).not.toBeNull();
    receive(gainTick + FORM_TICKS, [CILIA, PARAMECIUM]);
    expect(popup(HUD_TEST_ID.formPopup)).toBeNull();
  });

  it('hangs under the death text while the player is dead, and back above the cell once alive', () => {
    expect(host().getAttribute('data-placement')).toBe(UPGRADE_POPUP_PLACEMENT.aboveCell);
    // A pick made while spectating (overlays.md §3.3): the offer stays pickable while dead.
    receive(START_TICK + 1, [PARAMECIUM], PLAYER_LIFE_STATE.spectating);
    expect(popup(HUD_TEST_ID.formPopup)).not.toBeNull();
    expect(host().getAttribute('data-placement')).toBe(UPGRADE_POPUP_PLACEMENT.belowDeathText);
    receive(START_TICK + 2, [PARAMECIUM]);
    expect(host().getAttribute('data-placement')).toBe(UPGRADE_POPUP_PLACEMENT.aboveCell);
  });
});
