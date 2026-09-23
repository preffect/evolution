import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSnapshot,
  createTestTraitOfferView,
  playerId,
  type PlayerProgressView,
  type TraitId,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { OVERLAY_ALERT_KIND } from './format/overlay-alert';
import { ENCYCLOPEDIA_RETURN, HUD_OVERLAY, HudStateService } from './hud-state.service';
import { MenuOverlayComponent } from './menu-overlay.component';
import { HUD_TEST_ID, menuTraitTestId, testIdSelector } from '../test-ids/hud-test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const SNAPSHOT_TICK = 5000;
const NUCLEOID = 'nucleoid' as TraitId;
const MITOCHONDRION = 'mitochondrion' as TraitId;

describe('MenuOverlayComponent', () => {
  let hudState: HudStateService;
  let multiplayer: MultiplayerService;
  let canvasHost: HTMLElement;

  function query(testId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(testIdSelector(testId));
  }

  function showProgress(progress: Partial<PlayerProgressView> = {}): void {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(
      createTestSnapshot({
        tick: SNAPSHOT_TICK,
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID })],
        ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, ...progress }),
      }),
    );
  }

  /** Mounts the menu as the HUD does once `openOverlay` is `menu`, and runs its first render hooks. */
  function mountMenu(): { destroy(): void; text(): string } {
    const fixture = TestBed.createComponent(MenuOverlayComponent);
    fixture.detectChanges();
    TestBed.tick();
    return { destroy: () => fixture.destroy(), text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  }

  /** Clicks a control and renders what it changed. */
  function activate(testId: string): void {
    query(testId)!.click();
    TestBed.tick();
  }

  beforeEach(() => {
    canvasHost = document.body.appendChild(document.createElement('div'));
    canvasHost.tabIndex = 0;
    canvasHost.setAttribute('data-testid', HUD_TEST_ID.gameHost);
    canvasHost.focus();
    TestBed.configureTestingModule({ imports: [MenuOverlayComponent] });
    hudState = TestBed.inject(HudStateService);
    multiplayer = TestBed.inject(MultiplayerService);
    showProgress();
    hudState.openMenu();
  });

  afterEach(() => {
    canvasHost.remove();
    vi.restoreAllMocks();
  });

  it('opens as a modal dialog named Menu, with focus on Return to game', () => {
    mountMenu();
    const panel = query(HUD_TEST_ID.menuOverlay)!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(panel.getAttribute('aria-labelledby')!)?.textContent).toBe('Menu');
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuResume));
  });

  it('closes on Return to game, and focus goes back to the canvas host once the HUD unmounts it', () => {
    const menu = mountMenu();
    activate(HUD_TEST_ID.menuResume);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    menu.destroy();
    expect(document.activeElement).toBe(canvasHost);
  });

  it('closes on Escape the same way, through the HUD state the input seam drives', () => {
    const menu = mountMenu();
    hudState.pressMenuKey();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    menu.destroy();
    expect(document.activeElement).toBe(canvasHost);
  });

  it('holds Tab inside the panel: Shift+Tab from the first control wraps to the last', () => {
    mountMenu();
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    query(HUD_TEST_ID.menuResume)!.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(query(HUD_TEST_ID.menuOverlay)!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(query(HUD_TEST_ID.menuResume));
  });

  it('hands the screen to the encyclopedia, which comes back here with focus on Encyclopedia', () => {
    const menu = mountMenu();
    activate(HUD_TEST_ID.menuEncyclopedia);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.encyclopedia);
    expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.menu);
    expect(hudState.encyclopediaEntryId()).toBeNull();
    menu.destroy();

    hudState.pressMenuKey();
    mountMenu();
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuEncyclopedia));
  });

  it('lists the owned traits in catalog order, and a row opens its encyclopedia entry', () => {
    showProgress({
      ownedTraits: [
        { traitId: MITOCHONDRION, tier: 1 },
        { traitId: NUCLEOID, tier: 2 },
      ],
    });
    mountMenu();
    const rows = [...query(HUD_TEST_ID.menuTraits)!.querySelectorAll<HTMLElement>('ui-list-row')];
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      menuTraitTestId(NUCLEOID),
      menuTraitTestId(MITOCHONDRION),
    ]);
    expect(rows[0]?.textContent).toContain('Nucleoid Coil II');

    activate(menuTraitTestId(MITOCHONDRION));
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.encyclopedia);
    expect(hudState.encyclopediaEntryId()).toBe('trait:mitochondrion');
    expect(hudState.menuReturnFocusTestId()).toBe(menuTraitTestId(MITOCHONDRION));
  });

  it('says No traits yet before the first pick', () => {
    const menu = mountMenu();
    expect(query(HUD_TEST_ID.menuTraits)).toBeNull();
    expect(menu.text()).toContain('No traits yet');
  });

  it('asks once before leaving, with focus on Cancel; Escape restores the row and leaves the menu open', () => {
    mountMenu();
    activate(HUD_TEST_ID.menuExit);
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuExitCancel));

    const escape = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    query(HUD_TEST_ID.menuExitCancel)!.dispatchEvent(escape);
    TestBed.tick();

    expect(escape.defaultPrevented).toBe(true);
    expect(query(HUD_TEST_ID.menuExitCancel)).toBeNull();
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuExit));
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);
  });

  it('restores the row on Cancel, and leaves the room only on Exit', () => {
    const leave = vi.spyOn(multiplayer, 'leave').mockImplementation(() => undefined);
    mountMenu();
    activate(HUD_TEST_ID.menuExit);
    activate(HUD_TEST_ID.menuExitCancel);
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuExit));
    expect(leave).not.toHaveBeenCalled();

    activate(HUD_TEST_ID.menuExit);
    activate(HUD_TEST_ID.menuExitConfirm);
    expect(leave).toHaveBeenCalledOnce();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
  });

  it('carries an open offer in the alert strip, whose activation returns to the game', () => {
    const offer = createTestTraitOfferView({ level: 5, expiresAtTick: SNAPSHOT_TICK + 6.5 * TICK_HZ });
    showProgress({ level: 5, offer });
    mountMenu();
    const strip = query(HUD_TEST_ID.menuAlert)!;
    expect(strip.getAttribute('data-alert-kind')).toBe(OVERLAY_ALERT_KIND.offer);
    expect(strip.textContent).toContain('6.5 s');

    activate(HUD_TEST_ID.menuAlert);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
  });

  it('shows no alert strip while nothing is up', () => {
    mountMenu();
    expect(query(HUD_TEST_ID.menuAlert)).toBeNull();
  });
});
