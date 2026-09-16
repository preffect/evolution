import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  PLAYER_LIFE_STATE,
  ZONE_ID,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  entityId,
  playerId,
  type CellView,
  type MassFlowView,
  type OwnProgressView,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { AffectingPanelComponent } from './affecting-panel.component';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID, affectingTraitTestId, testIdSelector } from './test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const OWN_CELL_ID = entityId('c-own');
const OWN_MASS = 312;
const MITOCHONDRION = 'mitochondrion';
const FIRST_TIER = 1;

const massFlow: MassFlowView = {
  ratesPerSecond: { decay: -0.5 },
  zone: ZONE_ID.warmVent,
};

describe('AffectingPanelComponent', () => {
  let fixture: ComponentFixture<AffectingPanelComponent>;
  let multiplayer: MultiplayerService;
  let hudState: HudStateService;

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.affectingPanel));
  }

  /** Puts a live own cell in the room; the board is opened separately, since that is what shows the panel. */
  function show(cell: Partial<CellView> = {}, progress: Partial<OwnProgressView> = {}): void {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.sessionConfig.set(createTestSessionConfig());
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [
          createTestCellView({
            id: OWN_CELL_ID,
            playerId: OWN_PLAYER_ID,
            mass: OWN_MASS,
            traits: [{ traitId: MITOCHONDRION, tier: FIRST_TIER }],
            ...cell,
          }),
        ],
        ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, massFlow, ...progress }),
      }),
    );
    fixture.detectChanges();
  }

  function holdTab(): void {
    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AffectingPanelComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    hudState = TestBed.inject(HudStateService);
    fixture = TestBed.createComponent(AffectingPanelComponent);
    fixture.detectChanges();
  });

  it('draws nothing while the board is shut: it opens and closes with the full leaderboard', () => {
    show();
    expect(panel()).toBeNull();
  });

  it('opens while the board is held open, and closes again on the release', () => {
    show();
    holdTab();
    expect(panel()).not.toBeNull();

    hudState.setFullLeaderboardHeld(false);
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('is the kit side panel, so it and the ESC menu are one family (components-and-constants.md §10.2)', () => {
    show();
    holdTab();
    expect(panel()?.getAttribute('data-variant')).toBe('side');
    expect(panel()?.getAttribute('role')).toBe('region');
    expect(panel()?.getAttribute('aria-label')).toBe('Affecting you');
  });

  it('holds nothing focusable: Tab is being held, so focus stays where it was', () => {
    show();
    holdTab();
    const focusable = panel()?.querySelectorAll('button, a[href], input, select, textarea, [tabindex]');
    expect(focusable?.length).toBe(0);
  });

  it('carries the mass element and the world standing, the two rows the acceptance run reads', () => {
    show();
    holdTab();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector(testIdSelector(HUD_TEST_ID.affectingMass))).not.toBeNull();
    expect(host.querySelector(`[data-row-id="${HUD_TEST_ID.affectingWorld}"]`)).not.toBeNull();
  });

  it('marks an owned trait row with that trait glyph rather than a dot', () => {
    show();
    holdTab();
    const row = (fixture.nativeElement as HTMLElement).querySelector(
      `[data-row-id="${affectingTraitTestId(MITOCHONDRION)}"]`,
    );
    expect(row).not.toBeNull();
    expect(row?.querySelector(`app-trait-glyph svg[data-trait-id="${MITOCHONDRION}"]`)).not.toBeNull();
  });

  it('stands down while spectating: there is no cell to describe', () => {
    show({}, { lifeState: PLAYER_LIFE_STATE.spectating });
    holdTab();
    expect(panel()).toBeNull();
  });

  it('waits for the room config rather than guessing a round length for the world clock', () => {
    show();
    multiplayer.sessionConfig.set(null);
    holdTab();
    expect(panel()).toBeNull();
  });
});
