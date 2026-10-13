import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSnapshot,
  GIANT_SPECIES,
  entityId,
  gameId,
  playerId,
  type OwnedTrait,
  type PlayerLifeState,
  type GameSnapshot,
  type TraitId,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { GameEventBus } from '../state/game-event-bus';
import { SnapshotTransitionTracker } from '../state/snapshot-transitions';
import { createTestCellAbsorbedEffect, createTestCellView } from '../../../testing/builders';
import { paletteFor } from '../render/palette';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';
import { formRealLifeLine } from './format/form-facts';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES } from '../giants/giant-facts';
import { GIANT_POPUP_KICKER_TEXT } from './format/giant-popups';
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
const OWN_CELL_ID = entityId('c-own');
const GIANT_DNA = DEFAULT_BALANCE.giants.GIANT_DNA_BONUS;

describe('UpgradePopupComponent (docs/ui/overlays.md §3.8)', () => {
  let fixture: ComponentFixture<UpgradePopupComponent>;
  let multiplayer: MultiplayerService;
  let tracker: SnapshotTransitionTracker;

  /** One `game_snapshot` as the client takes it: the signal holds the newest, the bus hears every one (`render-session.ts`). */
  function deliver(snapshot: GameSnapshot): void {
    multiplayer.snapshot.set(snapshot);
    tracker.observe(snapshot);
  }

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
    deliver(createTestSnapshot({ tick, ownProgress }));
    fixture.detectChanges();
  }

  /** A snapshot in which the own cell has just swallowed the giant diatom. */
  function diatomSwallowedAt(tick: number): GameSnapshot {
    const ownProgress = createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, stage: CELL_STAGE.eukaryote });
    const cells = [createTestCellView({ id: OWN_CELL_ID, playerId: OWN_PLAYER_ID })];
    const swallow = createTestCellAbsorbedEffect({
      tick,
      playerId: null,
      predatorCellId: OWN_CELL_ID,
      predatorDnaGained: GIANT_DNA,
      preyGiantSpecies: GIANT_SPECIES.diatom,
    });
    return createTestSnapshot({ tick, ownProgress, cells, effects: [swallow] });
  }

  function textOf(element: HTMLElement | null, selector: string): string | undefined {
    return element?.querySelector(selector)?.textContent?.trim();
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
    tracker = new SnapshotTransitionTracker(TestBed.inject(GameEventBus), {
      ownPlayerId: OWN_PLAYER_ID,
      balance: DEFAULT_BALANCE,
      roundDurationSeconds: DEFAULT_BALANCE.session.ROUND_DURATION_SECONDS,
    });
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

  it('still shows both gains when the second pick’s snapshot overtook the first before the screen refreshed', () => {
    const firstTick = START_TICK + 1;
    const ownProgressOf = (ownedTraits: OwnedTrait[]) =>
      createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, stage: CELL_STAGE.eukaryote, ownedTraits });
    deliver(createTestSnapshot({ tick: firstTick, ownProgress: ownProgressOf([FLAGELLUM]) }));
    deliver(createTestSnapshot({ tick: firstTick + 1, ownProgress: ownProgressOf([FLAGELLUM, CILIA]) }));
    fixture.detectChanges();
    expect(popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(FLAGELLUM.traitId);
    receive(firstTick + 1 + UPGRADE_TICKS, [FLAGELLUM, CILIA]);
    expect(popup(HUD_TEST_ID.upgradePopup)?.getAttribute('data-trait-id')).toBe(CILIA.traitId);
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

  it('shows the giant popup as large as a form’s: the giant’s name, the DNA it paid and its real-life line', () => {
    const swallowTick = START_TICK + 1;
    deliver(diatomSwallowedAt(swallowTick));
    fixture.detectChanges();
    const shown = popup(HUD_TEST_ID.giantPopup);
    expect(shown).not.toBeNull();
    expect(shown?.getAttribute('data-giant-species')).toBe(GIANT_SPECIES.diatom);
    expect(shown?.hasAttribute('data-trait-id')).toBe(false);
    expect(shown?.classList.contains('form')).toBe(true);
    expect(textOf(shown, '.kicker')).toBe(GIANT_POPUP_KICKER_TEXT);
    expect(textOf(shown, '.title')).toBe(GIANT_DISPLAY_NAME_BY_SPECIES[GIANT_SPECIES.diatom]);
    expect(textOf(shown, '.effect')).toBe(`+${GIANT_DNA} DNA`);
    expect(textOf(shown, '.real-life')).toBe(GIANT_REAL_LIFE_LINES[GIANT_SPECIES.diatom]);

    receive(swallowTick + FORM_TICKS - 1, []);
    expect(popup(HUD_TEST_ID.giantPopup)).not.toBeNull();
    receive(swallowTick + FORM_TICKS, []);
    expect(popup(HUD_TEST_ID.giantPopup)).toBeNull();
  });

  it('shows a swallow whose snapshot a later one overtook before the screen refreshed, and only once', () => {
    const swallowTick = START_TICK + 1;
    const refreshTick = swallowTick + 1;
    deliver(diatomSwallowedAt(swallowTick));
    deliver(
      createTestSnapshot({ tick: refreshTick, ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID }) }),
    );
    fixture.detectChanges();
    expect(popup(HUD_TEST_ID.giantPopup)?.getAttribute('data-giant-species')).toBe(GIANT_SPECIES.diatom);

    receive(refreshTick + FORM_TICKS - 1, []);
    expect(host().querySelectorAll('.popup')).toHaveLength(1);
    receive(refreshTick + FORM_TICKS, []);
    expect(host().querySelector('.popup')).toBeNull();
    receive(refreshTick + FORM_TICKS + 1, []);
    expect(host().querySelector('.popup')).toBeNull();
  });

  it('shows a swallow once when the clock goes back before it, and comes back to it with no swallow since (#842)', () => {
    const swallowTick = START_TICK + 1;
    deliver(diatomSwallowedAt(swallowTick));
    fixture.detectChanges();
    expect(popup(HUD_TEST_ID.giantPopup)).not.toBeNull();

    // A new room under the same seat: its clock starts behind the swallow, and the memory starts over.
    receive(START_TICK - 1, []);
    expect(host().querySelector('.popup')).toBeNull();
    receive(swallowTick, []);
    receive(swallowTick + 1, []);
    expect(host().querySelector('.popup')).toBeNull();
  });
});
