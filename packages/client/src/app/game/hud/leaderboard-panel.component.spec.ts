import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTestPlayerProgressView,
  createTestSnapshot,
  playerId,
  type LeaderboardRow,
  type PlayerId,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { paletteFor } from '../render/palette';
import { LEADERBOARD_COMPACT_ROWS, LEADERBOARD_FULL_ROWS } from './hud-constants';
import { HudStateService } from './hud-state.service';
import { LeaderboardPanelComponent } from './leaderboard-panel.component';
import { HUD_TEST_ID, leaderboardRowTestId, testIdSelector } from './test-ids';
import { seatMarkBeadCount } from './format/seat-mark';

const OWN_PLAYER_ID = playerId('player-me');

function testRow(rank: number, id: PlayerId): LeaderboardRow {
  return { rank, playerId: id, score: rank * 10, mass: rank * 7, level: rank, absorptions: rank };
}

function boardOf(count: number, ownRank: number | null): LeaderboardRow[] {
  return Array.from({ length: count }, (_unused, index) =>
    testRow(index + 1, index + 1 === ownRank ? OWN_PLAYER_ID : playerId(`player-${index + 1}`)),
  );
}

describe('LeaderboardPanelComponent', () => {
  let fixture: ComponentFixture<LeaderboardPanelComponent>;
  let multiplayer: MultiplayerService;
  let hudState: HudStateService;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowElements(): HTMLElement[] {
    return [...element().querySelectorAll<HTMLElement>('li.row')];
  }

  function showBoard(rows: LeaderboardRow[], avatarAssignments: Record<string, number> = {}): void {
    multiplayer.playerId.set(OWN_PLAYER_ID);
    multiplayer.avatarAssignments.set(avatarAssignments);
    multiplayer.snapshot.set(
      createTestSnapshot({
        leaderboard: rows,
        players: Object.fromEntries(
          rows.map((row) => [
            row.playerId,
            createTestPlayerProgressView({ playerId: row.playerId, playerName: `Player ${row.rank}` }),
          ]),
        ),
      }),
    );
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LeaderboardPanelComponent] });
    multiplayer = TestBed.inject(MultiplayerService);
    hudState = TestBed.inject(HudStateService);
    fixture = TestBed.createComponent(LeaderboardPanelComponent);
    fixture.detectChanges();
  });

  it('mounts the panel with its header and the Tab hint, and no rows before a snapshot', () => {
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).not.toBeNull();
    const header = element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardHeader));
    expect(header?.textContent).toContain('Leaderboard');
    expect(header?.textContent).toContain('Tab');
    expect(rowElements()).toEqual([]);
  });

  it('shows the top five compact, one row per player, in rank order', () => {
    showBoard(boardOf(8, 2));
    const rows = rowElements();
    expect(rows).toHaveLength(LEADERBOARD_COMPACT_ROWS);
    expect(rows.map((row) => row.querySelector('.rank')?.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(rows.map((row) => row.querySelector('.name')?.textContent)).toEqual([
      'Player 1',
      'Player 2',
      'Player 3',
      'Player 4',
      'Player 5',
    ]);
  });

  it('names each row by its player and tints the own one', () => {
    showBoard(boardOf(3, 2));
    const ownRow = element().querySelector<HTMLElement>(testIdSelector(leaderboardRowTestId(OWN_PLAYER_ID)));
    expect(ownRow).not.toBeNull();
    expect(ownRow?.classList.contains('own')).toBe(true);
    expect(ownRow?.style.background).not.toBe('');
    const otherRow = element().querySelector<HTMLElement>(testIdSelector(leaderboardRowTestId(playerId('player-1'))));
    expect(otherRow?.style.background).toBe('');
  });

  it('keeps the own row on the board when its rank is outside the compact cut', () => {
    showBoard(boardOf(8, 8));
    const rows = rowElements();
    expect(rows).toHaveLength(LEADERBOARD_COMPACT_ROWS);
    expect(rows.at(-1)?.dataset['testid']).toBe(leaderboardRowTestId(OWN_PLAYER_ID));
    expect(rows.at(-1)?.querySelector('.rank')?.textContent).toBe('8');
  });

  it('hides mass and absorptions until the full list is open, then shows them under their labels', () => {
    showBoard(boardOf(8, 1));
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFull))).toBeNull();
    expect(rowElements()[0]?.querySelector('.mass')).toBeNull();
    expect(element().querySelector('.column-labels')).toBeNull();

    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();

    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFull))).not.toBeNull();
    expect(rowElements()).toHaveLength(LEADERBOARD_FULL_ROWS);
    const firstRow = rowElements()[0];
    expect(firstRow?.querySelector('.mass')?.textContent).toBe('7');
    expect(firstRow?.querySelector('.absorptions')?.textContent).toBe('1');
    // The three numeric columns carry no unit of their own, so the full list names them.
    expect(element().querySelector('.column-labels')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('ScoreMassEaten');
  });

  it('places each label in its own track and keeps the row classes off the strip', () => {
    showBoard(boardOf(3, 1));
    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
    const labels = element().querySelector<HTMLElement>('.column-labels');

    // Each label sits in a track of its own rather than auto-flowing off one start column, so none
    // can slide onto its neighbour; the shared fixed track list in the stylesheet does the rest.
    expect(labels?.querySelector('.label-score')).not.toBeNull();
    expect(labels?.querySelector('.label-mass')).not.toBeNull();
    expect(labels?.querySelector('.label-absorptions')).not.toBeNull();
    // The strip does not carry the row's numeric classes, which would take the row's mono font and
    // colour over the strip's own caption and split three labels across two colours.
    expect(labels?.querySelector('.score, .mass, .absorptions')).toBeNull();
  });

  it('toggles the full list from the header, so a pointer reaches what Tab does', () => {
    showBoard(boardOf(8, 1));
    const header = element().querySelector<HTMLButtonElement>(testIdSelector(HUD_TEST_ID.leaderboardHeader));

    header?.click();
    fixture.detectChanges();
    expect(hudState.isFullLeaderboardOpen()).toBe(true);
    expect(header?.getAttribute('aria-expanded')).toBe('true');

    header?.click();
    fixture.detectChanges();
    expect(hudState.isFullLeaderboardOpen()).toBe(false);
  });

  it('draws each swatch in its seat’s palette with its seat-mark beads', () => {
    const avatarIndex = 4;
    showBoard(boardOf(1, 1), { [OWN_PLAYER_ID]: avatarIndex });
    const swatch = rowElements()[0]?.querySelector('svg.swatch');
    const [body, ...beads] = [...(swatch?.querySelectorAll('circle') ?? [])];
    expect(body?.getAttribute('fill')).toBe(paletteFor(avatarIndex).base);
    expect(body?.getAttribute('stroke')).toBe(paletteFor(avatarIndex).rim);
    expect(beads).toHaveLength(seatMarkBeadCount(avatarIndex));
  });

  it('re-ranks in place when a kill moves the board, keeping one row per player', () => {
    showBoard(boardOf(3, 1));
    const before = rowElements().map((row) => row.dataset['testid']);

    multiplayer.snapshot.set(
      createTestSnapshot({
        leaderboard: [
          { ...testRow(1, playerId('player-2')), score: 999 },
          { ...testRow(2, OWN_PLAYER_ID) },
          { ...testRow(3, playerId('player-3')) },
        ],
        players: multiplayer.snapshot()?.players ?? {},
      }),
    );
    fixture.detectChanges();

    const after = rowElements().map((row) => row.dataset['testid']);
    expect(after).toEqual([leaderboardRowTestId(playerId('player-2')), leaderboardRowTestId(OWN_PLAYER_ID), before[2]]);
    expect(new Set(after).size).toBe(after.length);
  });
});
