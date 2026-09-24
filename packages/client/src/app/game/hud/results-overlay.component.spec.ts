import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ROUND_PHASE,
  TICK_HZ,
  createTestSessionConfig,
  createTestSnapshot,
  playerId,
  type LeaderboardRow,
  type PlayerId,
  type RoundPhase,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { paletteFor } from '../render/palette';
import { hexWithAlpha } from './format/tint';
import { LEADERBOARD_OWN_ROW_TINT_ALPHA } from './hud-constants';
import { ResultsOverlayComponent } from './results-overlay.component';
import { HUD_TEST_ID, resultsRowTestId, testIdSelector } from '../test-ids/hud-test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const RIVAL_PLAYER_ID = playerId('player-rival');
const OWN_AVATAR_INDEX = 3;
const ROUND_DURATION_SECONDS = 120;
const ROUND_START_TICK = 600;
const RESULTS_START_TICK = ROUND_START_TICK + ROUND_DURATION_SECONDS * TICK_HZ;
const ROSTER = {
  [OWN_PLAYER_ID]: { playerId: OWN_PLAYER_ID, playerName: 'Me' },
  [RIVAL_PLAYER_ID]: { playerId: RIVAL_PLAYER_ID, playerName: 'Amoeboid' },
};

function row(rank: number, id: PlayerId, score: number): LeaderboardRow {
  return { rank, playerId: id, score, mass: 52, level: 4, absorptions: 2 };
}

describe('ResultsOverlayComponent', () => {
  let fixture: ComponentFixture<ResultsOverlayComponent>;
  let multiplayer: MultiplayerService;

  function byTestId(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(testIdSelector(testId));
  }

  function textOf(testId: string): string | undefined {
    return byTestId(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  }

  /** A row's cells as read left to right: the swatch draws no text, so it reads as an empty cell. */
  function cellsOf(rank: number): readonly string[] {
    return [...(byTestId(resultsRowTestId(rank))?.children ?? [])].map((cell) => cell.textContent?.trim() ?? '');
  }

  function show(roundPhase: RoundPhase, tick: number, leaderboard: readonly LeaderboardRow[]): void {
    multiplayer.snapshot.set(
      createTestSnapshot({
        roundPhase,
        tick,
        roundStartTick: ROUND_START_TICK,
        leaderboard: [...leaderboard],
        players: ROSTER,
      }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ResultsOverlayComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.avatarAssignments.set({ [OWN_PLAYER_ID]: OWN_AVATAR_INDEX, [RIVAL_PLAYER_ID]: 1 });
    multiplayer.sessionConfig.set(createTestSessionConfig({ roundDurationSeconds: ROUND_DURATION_SECONDS }));
    multiplayer.balance.set(DEFAULT_BALANCE);
    fixture = TestBed.createComponent(ResultsOverlayComponent);
    fixture.detectChanges();
  });

  it('draws nothing while the round is playing', () => {
    show(ROUND_PHASE.playing, RESULTS_START_TICK - 1, [row(1, OWN_PLAYER_ID, 90)]);
    expect(byTestId(HUD_TEST_ID.resultsOverlay)).toBeNull();
  });

  it('names the winner, ranks everyone and counts down to the next round', () => {
    show(ROUND_PHASE.results, RESULTS_START_TICK + 3 * TICK_HZ, [
      row(2, OWN_PLAYER_ID, 60),
      row(1, RIVAL_PLAYER_ID, 90),
    ]);

    expect(byTestId(HUD_TEST_ID.resultsOverlay)).not.toBeNull();
    expect(textOf(HUD_TEST_ID.resultsWinner)).toBe('Amoeboid wins');
    expect(cellsOf(1)).toEqual(['1', '', 'Amoeboid', 'L4', '52', '2', '90']);
    expect(cellsOf(2)).toEqual(['2', '', 'Me', 'L4', '52', '2', '60']);
    const resultsSeconds = DEFAULT_BALANCE.session.RESULTS_SCREEN_SECONDS;
    expect(textOf(HUD_TEST_ID.resultsCountdown)).toBe(`Next round in ${resultsSeconds - 3} s`);
  });

  it('says `You win` to the winner and tints only the own row in its seat colour', () => {
    show(ROUND_PHASE.results, RESULTS_START_TICK, [row(1, OWN_PLAYER_ID, 90), row(2, RIVAL_PLAYER_ID, 60)]);

    expect(textOf(HUD_TEST_ID.resultsWinner)).toBe('You win');
    const ownTint = hexWithAlpha(paletteFor(OWN_AVATAR_INDEX).rim, LEADERBOARD_OWN_ROW_TINT_ALPHA);
    const tint = (rank: number): string | undefined => byTestId(resultsRowTestId(rank))?.style.background;
    expect(tint(1)).toBe(serialisedBackground(ownTint));
    expect(tint(2)).toBe('');
  });

  it('says `Next round soon` while the room’s config has not arrived', () => {
    multiplayer.sessionConfig.set(null);
    show(ROUND_PHASE.results, RESULTS_START_TICK, [row(1, OWN_PLAYER_ID, 90)]);
    expect(textOf(HUD_TEST_ID.resultsCountdown)).toBe('Next round soon');
  });

  it('leaves to the lobby from its one button', () => {
    const leave = vi.spyOn(multiplayer, 'leave').mockImplementation(() => undefined);
    show(ROUND_PHASE.results, RESULTS_START_TICK, [row(1, OWN_PLAYER_ID, 90)]);

    byTestId(HUD_TEST_ID.resultsLeave)?.click();

    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('goes when the next round starts', () => {
    show(ROUND_PHASE.results, RESULTS_START_TICK, [row(1, OWN_PLAYER_ID, 90)]);
    show(ROUND_PHASE.playing, RESULTS_START_TICK + 1, [row(1, OWN_PLAYER_ID, 0)]);
    expect(byTestId(HUD_TEST_ID.resultsOverlay)).toBeNull();
  });
});

/** A background colour as the DOM reads it back once set, so the tint compares whatever notation it serialises to. */
function serialisedBackground(hex: string): string {
  const probe = document.createElement('div');
  probe.style.background = hex;
  return probe.style.background;
}
