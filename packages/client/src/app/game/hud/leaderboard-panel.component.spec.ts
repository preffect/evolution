import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  createTestPlayerProgressView,
  createTestSnapshot,
  playerId,
  type LeaderboardRow,
  type PlayerId,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';
import { paletteFor } from '../render/palette';
import {
  LEADERBOARD_COLUMN_GAP_PX,
  LEADERBOARD_COMPACT_ROWS,
  LEADERBOARD_ENGULFS_COLUMN_PX,
  LEADERBOARD_FOOTER_ROW_HEIGHT_PX,
  LEADERBOARD_FULL_ROWS,
  LEADERBOARD_FULL_WIDTH_PX,
  LEADERBOARD_HEADER_HEIGHT_PX,
  LEADERBOARD_LABEL_ROW_HEIGHT_PX,
  LEADERBOARD_LEVEL_COLUMN_PX,
  LEADERBOARD_MASS_COLUMN_PX,
  LEADERBOARD_NAME_COLUMN_MIN_PX,
  LEADERBOARD_PADDING_PX,
  LEADERBOARD_RANK_COLUMN_PX,
  LEADERBOARD_RIM_PX,
  LEADERBOARD_ROW_HEIGHT_PX,
  LEADERBOARD_SCORE_COLUMN_PX,
  LEADERBOARD_SWATCH_COLUMN_PX,
} from './hud-constants';
import { HudStateService } from './hud-state.service';
import { LeaderboardPanelComponent } from './leaderboard-panel.component';
import { HUD_TEST_ID, leaderboardRowTestId, testIdSelector } from '../test-ids/hud-test-ids';
import {
  LEADERBOARD_COMPACT_LABELS,
  LEADERBOARD_FULL_LABELS,
  LEADERBOARD_TEXT,
  leaderboardFooterText,
} from './format/leaderboard-labels';
import { seatMarkBeadCount } from './format/seat-mark';

const OWN_PLAYER_ID = playerId('player-me');

/** The full list's fixed tracks, in the stylesheet's order: rank, swatch, (name), level, score, mass, engulfs. */
const FULL_FIXED_TRACKS_PX = [
  LEADERBOARD_RANK_COLUMN_PX,
  LEADERBOARD_SWATCH_COLUMN_PX,
  LEADERBOARD_LEVEL_COLUMN_PX,
  LEADERBOARD_SCORE_COLUMN_PX,
  LEADERBOARD_MASS_COLUMN_PX,
  LEADERBOARD_ENGULFS_COLUMN_PX,
];
/** The `1fr` name track plus the fixed ones. */
const FULL_TRACK_COUNT = FULL_FIXED_TRACKS_PX.length + 1;
const SIDES = 2;

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

  function labelStripText(): string {
    const strip = element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardLabels));
    return [...(strip?.querySelectorAll('span') ?? [])].map((label) => label.textContent).join(' ');
  }

  function footer(): Element | null {
    return element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFooter));
  }

  it('mounts the panel with its header and the hold-Tab hint, and no rows before a snapshot', () => {
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).not.toBeNull();
    const header = element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardHeader));
    expect(header?.querySelector('.header-title')?.textContent).toBe(LEADERBOARD_TEXT.title);
    expect(header?.querySelector('.header-hint')?.textContent).toBe(LEADERBOARD_TEXT.hintClosed);
    expect(rowElements()).toEqual([]);
  });

  it('labels the compact panel LV SCORE, with no footer', () => {
    showBoard(boardOf(3, 1));
    expect(labelStripText()).toBe(LEADERBOARD_COMPACT_LABELS.map((label) => label.text).join(' '));
    expect(labelStripText()).toBe('LV SCORE');
    expect(footer()).toBeNull();
  });

  it('labels the full list LV SCORE MASS ENGULFS, reads TAB HELD and adds the score rule from the balance', () => {
    multiplayer.balance.set(DEFAULT_BALANCE);
    showBoard(boardOf(3, 1));
    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();

    expect(labelStripText()).toBe(LEADERBOARD_FULL_LABELS.map((label) => label.text).join(' '));
    expect(labelStripText()).toBe('LV SCORE MASS ENGULFS');
    expect(element().querySelector('.header-hint')?.textContent).toBe(LEADERBOARD_TEXT.hintOpen);
    expect(footer()?.textContent).toBe(leaderboardFooterText(DEFAULT_BALANCE.session.SCORE_ABSORPTION_BONUS));
  });

  it('reads CLICK TO CLOSE after the header opened the full list, and TAB HELD once Tab takes it over', () => {
    showBoard(boardOf(3, 1));
    element().querySelector<HTMLButtonElement>(testIdSelector(HUD_TEST_ID.leaderboardHeader))?.click();
    fixture.detectChanges();
    expect(element().querySelector('.header-hint')?.textContent).toBe(LEADERBOARD_TEXT.hintClicked);

    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
    expect(element().querySelector('.header-hint')?.textContent).toBe(LEADERBOARD_TEXT.hintOpen);
  });

  it('leaves the full list a name track wide enough for a wide 12-character name at scale 1', () => {
    // jsdom lays nothing out, so this is the stylesheet's grid arithmetic from the same constants:
    // the panel width less its rims, its padding, the gaps between tracks and every fixed track.
    const fixedPx = FULL_FIXED_TRACKS_PX.reduce((total, trackPx) => total + trackPx, 0);
    const nameTrackPx =
      LEADERBOARD_FULL_WIDTH_PX -
      SIDES * (LEADERBOARD_RIM_PX + LEADERBOARD_PADDING_PX) -
      (FULL_TRACK_COUNT - 1) * LEADERBOARD_COLUMN_GAP_PX -
      fixedPx;
    // `BigHungryAmo` in `body` measures 105 px; the constant is that width (docs/ui/hud.md §3.1.1).
    expect(nameTrackPx).toBeGreaterThanOrEqual(LEADERBOARD_NAME_COLUMN_MIN_PX);
  });

  it('sizes the panel for the header, the strip, the rows and, on the full list, the footer', () => {
    showBoard(boardOf(3, 1));
    const panel = (): HTMLElement | null =>
      element().querySelector<HTMLElement>(testIdSelector(HUD_TEST_ID.leaderboard));
    const compactHeight =
      LEADERBOARD_HEADER_HEIGHT_PX + LEADERBOARD_LABEL_ROW_HEIGHT_PX + 3 * LEADERBOARD_ROW_HEIGHT_PX;
    expect(panel()?.style.getPropertyValue('--hud-leaderboard-height')).toBe(`${compactHeight}px`);

    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
    expect(panel()?.style.getPropertyValue('--hud-leaderboard-height')).toBe(
      `${compactHeight + LEADERBOARD_FOOTER_ROW_HEIGHT_PX}px`,
    );
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
    expect(element().querySelector('.label-mass')).toBeNull();

    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();

    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFull))).not.toBeNull();
    expect(rowElements()).toHaveLength(LEADERBOARD_FULL_ROWS);
    const firstRow = rowElements()[0];
    expect(firstRow?.querySelector('.mass')?.textContent).toBe('7');
    expect(firstRow?.querySelector('.absorptions')?.textContent).toBe('1');
    expect(element().querySelector('.label-absorptions')?.textContent).toBe('ENGULFS');
  });

  it('places each label in its own track and keeps the row classes off the strip', () => {
    showBoard(boardOf(3, 1));
    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
    const labels = element().querySelector<HTMLElement>('.column-labels');

    // Each label sits in a track of its own rather than auto-flowing off one start column, so none
    // can slide onto its neighbour; the shared fixed track list in the stylesheet does the rest.
    expect(labels?.querySelector('.label-level')).not.toBeNull();
    expect(labels?.querySelector('.label-score')).not.toBeNull();
    expect(labels?.querySelector('.label-mass')).not.toBeNull();
    expect(labels?.querySelector('.label-absorptions')).not.toBeNull();
    // The strip does not carry the row's numeric classes, which would take the row's mono font and
    // colour over the strip's own caption and split three labels across two colours.
    expect(labels?.querySelector('.level, .score, .mass, .absorptions')).toBeNull();
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

  describe('the full layout waits for the panel to finish widening (#615)', () => {
    /** A width transition under test control: its `finished` settles when the test says so. */
    function fakeWidthTransition(): { animation: Animation; finish(): void; cancel(): void } {
      let resolve: () => void = () => undefined;
      let reject: (reason: Error) => void = () => undefined;
      const finished = new Promise<Animation>((onResolve, onReject) => {
        resolve = () => onResolve(animation);
        reject = onReject;
      });
      const animation = { transitionProperty: 'width', playState: 'running', finished } as unknown as Animation;
      return {
        animation,
        finish: () => {
          (animation as { playState: string }).playState = 'finished';
          resolve();
        },
        cancel: () => {
          (animation as { playState: string }).playState = 'idle';
          reject(new Error('cancelled'));
        },
      };
    }

    function panelElement(): HTMLElement {
      return element().querySelector<HTMLElement>('.leaderboard')!;
    }

    /** The panel reports these animations from now on, as `getAnimations` would. */
    function animating(animations: readonly Animation[]): void {
      Object.defineProperty(panelElement(), 'getAnimations', { configurable: true, value: () => animations });
    }

    function isFullLayout(): boolean {
      return panelElement().classList.contains('full-layout');
    }

    async function hold(isHeld: boolean): Promise<void> {
      hudState.setFullLeaderboardHeld(isHeld);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    beforeEach(() => {
      multiplayer.balance.set(DEFAULT_BALANCE);
      showBoard(boardOf(3, 1));
    });

    it('draws the full layout at once when no width transition runs (reduced motion, a remount)', async () => {
      animating([]);
      await hold(true);
      expect(isFullLayout()).toBe(true);
      expect(footer()).not.toBeNull();
    });

    it('keeps the compact columns and no footer while the width transition runs, and goes full when it ends', async () => {
      const widening = fakeWidthTransition();
      animating([widening.animation]);
      await hold(true);
      expect(isFullLayout()).toBe(false);
      expect(labelStripText()).toBe('LV SCORE');
      expect(footer()).toBeNull();
      widening.finish();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(isFullLayout()).toBe(true);
    });

    it('recovers from a cancelled transition, which fires no transitionend (a fast release and re-press)', async () => {
      const widening = fakeWidthTransition();
      animating([widening.animation]);
      await hold(true);
      animating([]);
      widening.cancel();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(isFullLayout()).toBe(true);
    });

    it('re-reads the running transition on a transition event, so an unrelated one never settles it early', async () => {
      const widening = fakeWidthTransition();
      animating([widening.animation]);
      await hold(true);
      panelElement()
        .querySelector('li, .header')
        ?.dispatchEvent(new Event('transitionend', { bubbles: true }));
      panelElement().dispatchEvent(new Event('transitioncancel'));
      fixture.detectChanges();
      expect(isFullLayout()).toBe(false);
    });

    it('drops the full layout the moment the list closes, before the panel narrows', async () => {
      animating([]);
      await hold(true);
      expect(isFullLayout()).toBe(true);
      animating([fakeWidthTransition().animation]);
      hudState.setFullLeaderboardHeld(false);
      fixture.detectChanges();
      expect(isFullLayout()).toBe(false);
      expect(footer()).toBeNull();
    });
  });
});
