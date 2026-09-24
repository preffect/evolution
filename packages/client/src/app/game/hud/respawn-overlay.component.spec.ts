import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PLAYER_LIFE_STATE,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSnapshot,
  entityId,
  playerId,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { MultiplayerService } from '../../services/multiplayer.service';
import { RespawnOverlayComponent } from './respawn-overlay.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const KILLER_PLAYER_ID = playerId('player-killer');
const KILLER_CELL_ID = entityId('killer-cell');
const KILLER_ROSTER = {
  [KILLER_PLAYER_ID]: { playerId: KILLER_PLAYER_ID, playerName: 'Amoeboid' },
};

describe('RespawnOverlayComponent', () => {
  let fixture: ComponentFixture<RespawnOverlayComponent>;
  let multiplayer: MultiplayerService;

  function byTestId(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(testId));
  }

  function showAlive(dnaTowardNextLevel: number): void {
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ playerId: OWN_PLAYER_ID })],
        players: KILLER_ROSTER,
        ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, level: 3, dnaTowardNextLevel }),
      }),
    );
    fixture.detectChanges();
  }

  function showSpectating(respawnInTicks: number): void {
    multiplayer.snapshot.set(
      createTestSnapshot({
        cells: [createTestCellView({ id: KILLER_CELL_ID, playerId: KILLER_PLAYER_ID })],
        players: KILLER_ROSTER,
        ownProgress: createTestPlayerProgressView({
          playerId: OWN_PLAYER_ID,
          level: 3,
          ownedTraits: [{ traitId: 'nucleoid', tier: 1 }],
          dnaTowardNextLevel: 5,
          lifeState: PLAYER_LIFE_STATE.spectating,
          spectatingCellId: KILLER_CELL_ID,
          respawnInTicks,
        }),
      }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RespawnOverlayComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.playerId.set(OWN_PLAYER_ID);
    fixture = TestBed.createComponent(RespawnOverlayComponent);
    fixture.detectChanges();
  });

  it('draws nothing while the player is alive', () => {
    showAlive(30);
    expect(byTestId(HUD_TEST_ID.respawnOverlay)).toBeNull();
  });

  it('names the killer, counts down and says what death kept and cost, from the last alive snapshot', () => {
    showAlive(30);
    showSpectating(3 * TICK_HZ);

    expect(byTestId(HUD_TEST_ID.respawnOverlay)).not.toBeNull();
    expect(byTestId(HUD_TEST_ID.respawnKiller)?.textContent?.trim()).toBe('ENGULFED BY AMOEBOID');
    expect(byTestId(HUD_TEST_ID.respawnCountdown)?.textContent?.trim()).toBe('Respawning in 3');
    expect(byTestId(HUD_TEST_ID.respawnKept)?.textContent?.trim()).toBe('Level 3 and 1 trait kept · 25 DNA lost');
  });

  it('announces the countdown politely as it ticks', () => {
    showAlive(30);
    showSpectating(3 * TICK_HZ);
    showSpectating(TICK_HZ);

    const countdown = byTestId(HUD_TEST_ID.respawnCountdown);
    expect(countdown?.getAttribute('aria-live')).toBe('polite');
    expect(countdown?.textContent?.trim()).toBe('Respawning in 1');
  });

  it('stands down on respawn', () => {
    showAlive(30);
    showSpectating(TICK_HZ);
    showAlive(5);
    expect(byTestId(HUD_TEST_ID.respawnOverlay)).toBeNull();
  });
});
