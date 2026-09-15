import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  ROUND_PHASE,
  createTestSessionConfig,
  createTestSnapshot,
  type RoundPhase,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { ROUND_CLOCK_PULSE_LAST_SECONDS } from './hud-constants';
import { RoundTimerComponent } from './round-timer.component';
import { HUD_TEST_ID, testIdSelector } from './test-ids';
import { ROUND_CLOCK_CAPTION, bloomCaptionText } from './format/round-clock';

const ROUND_SECONDS = 60;

describe('RoundTimerComponent', () => {
  let fixture: ComponentFixture<RoundTimerComponent>;
  let multiplayer: MultiplayerService;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function clockText(): string | undefined {
    return element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))?.textContent ?? undefined;
  }

  function captionText(): string | undefined {
    return element().querySelector(testIdSelector(HUD_TEST_ID.roundPhase))?.textContent ?? undefined;
  }

  function showRound(secondsLeft: number, roundPhase: RoundPhase = ROUND_PHASE.playing): void {
    multiplayer.snapshot.set(
      createTestSnapshot({ roundPhase, roundTimeLeftMs: secondsLeft * MILLISECONDS_PER_SECOND }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RoundTimerComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.sessionConfig.set(createTestSessionConfig({ roundDurationSeconds: ROUND_SECONDS }));
    multiplayer.balance.set(DEFAULT_BALANCE);
    fixture = TestBed.createComponent(RoundTimerComponent);
    fixture.detectChanges();
  });

  it('shows nothing before the first snapshot', () => {
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))).toBeNull();
  });

  it('reads m:ss with the ROUND caption through the body of a round', () => {
    showRound(ROUND_SECONDS);
    expect(clockText()).toBe('1:00');
    expect(captionText()).toBe(ROUND_CLOCK_CAPTION.round);
    expect(element().querySelector('.round-timer')?.classList.contains('bloom')).toBe(false);
  });

  it('counts down as the snapshots arrive', () => {
    showRound(ROUND_SECONDS);
    showRound(42);
    expect(clockText()).toBe('0:42');
  });

  it('turns gold and names the bloom’s effect once the bloom starts', () => {
    showRound(Math.round(ROUND_SECONDS * (1 - DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION)));
    expect(captionText()).toBe(
      bloomCaptionText(
        DEFAULT_BALANCE.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER,
        DEFAULT_BALANCE.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER,
      ),
    );
    expect(element().querySelector('.round-timer')?.classList.contains('bloom')).toBe(true);
  });

  it('pulses through the last ten seconds', () => {
    showRound(ROUND_CLOCK_PULSE_LAST_SECONDS + 1);
    expect(element().querySelector('.round-timer')?.classList.contains('pulsing')).toBe(false);
    showRound(ROUND_CLOCK_PULSE_LAST_SECONDS);
    expect(element().querySelector('.round-timer')?.classList.contains('pulsing')).toBe(true);
  });

  it('stands down for the results overlay, which shows its own countdown', () => {
    showRound(0, ROUND_PHASE.results);
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))).toBeNull();
  });
});
