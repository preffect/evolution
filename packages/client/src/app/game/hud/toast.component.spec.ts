import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  TICK_HZ,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
  type GameSnapshot,
  type OwnProgressView,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';
import { TOAST_KIND, STAGE_TOAST_TEXT, TOAST_TEXT, lateJoinToastText } from './format/toasts';
import { TOAST_DURATION_SECONDS } from './hud-constants';
import { ToastComponent } from './toast.component';

const OWN_PLAYER_ID = playerId('player-me');
const ROUND_DURATION_SECONDS = 300;
const START_TICK = 600;
const ROUND_START_MS = ROUND_DURATION_SECONDS * MILLISECONDS_PER_SECOND;
const LATE_JOIN_DNA = 60;

function progress(overrides: Partial<OwnProgressView> = {}): OwnProgressView {
  return createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, stage: CELL_STAGE.prokaryote, ...overrides });
}

describe('ToastComponent (docs/ui/overlays.md §3.6)', () => {
  let fixture: ComponentFixture<ToastComponent>;
  let multiplayer: MultiplayerService;

  function receive(tick: number, overrides: Partial<GameSnapshot> = {}): void {
    multiplayer.snapshot.set(
      createTestSnapshot({ tick, roundTimeLeftMs: ROUND_START_MS, ownProgress: progress(), ...overrides }),
    );
    fixture.detectChanges();
  }

  function toast(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(HUD_TEST_ID.toast));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ToastComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.gameId.set(gameId('game-1'));
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.sessionConfig.set(createTestSessionConfig({ roundDurationSeconds: ROUND_DURATION_SECONDS }));
    fixture = TestBed.createComponent(ToastComponent);
  });

  it('shows nothing on an ordinary join, inside a polite live region', () => {
    receive(START_TICK);
    expect(toast()).toBeNull();
    const live = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(live?.getAttribute('aria-live')).toBe('polite');
  });

  it('greets a late joiner with its level and catch-up DNA, tagged with its kind', () => {
    receive(START_TICK, { ownProgress: progress({ level: 2, dnaCatchUpGift: LATE_JOIN_DNA }) });
    expect(toast()?.getAttribute('data-toast-kind')).toBe(TOAST_KIND.lateJoin);
    expect(toast()?.textContent?.trim()).toBe(lateJoinToastText(2, LATE_JOIN_DNA));
  });

  it('announces the bloom as the clock enters it, and takes it down after TOAST_DURATION_SECONDS', () => {
    receive(START_TICK);
    const bloomTick = START_TICK + 1;
    receive(bloomTick, { roundTimeLeftMs: 0 });
    expect(toast()?.getAttribute('data-toast-kind')).toBe(TOAST_KIND.bloom);
    expect(toast()?.textContent?.trim()).toBe(TOAST_TEXT.bloom);
    receive(bloomTick + TOAST_DURATION_SECONDS * TICK_HZ, { roundTimeLeftMs: 0 });
    expect(toast()).toBeNull();
  });

  it('replaces the toast that is up with the newest', () => {
    receive(START_TICK);
    receive(START_TICK + 1, { roundTimeLeftMs: 0 });
    receive(START_TICK + 2, { roundTimeLeftMs: 0, ownProgress: progress({ stage: CELL_STAGE.eukaryote }) });
    expect(toast()?.getAttribute('data-toast-kind')).toBe(TOAST_KIND.stage);
    expect(toast()?.textContent?.trim()).toBe(STAGE_TOAST_TEXT.eukaryote);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll(testIdSelector(HUD_TEST_ID.toast))).toHaveLength(1);
  });
});
