// The leaderboard (docs/UI.md §3.1.1): top-right, compact by default, the full list with mass and
// absorptions while Tab is held or after the header is clicked. Rows are absolutely placed by their
// slot so a re-sort slides rather than jumps. It decides nothing about who is shown or what a row
// reads — `leaderboardEntriesFor` does — and nothing about the swatch — `leaderboard-swatch.ts`
// does. The stylesheet is the sibling `.css`; every length and colour in it is a `--hud-…` the
// shell publishes from the constants.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStateService } from '../state/game-state.service';
import {
  LEADERBOARD_COMPACT_ROWS,
  LEADERBOARD_FULL_ROWS,
  LEADERBOARD_HEADER_HEIGHT_PX,
  LEADERBOARD_LABEL_ROW_HEIGHT_PX,
  LEADERBOARD_ROW_HEIGHT_PX,
  LEADERBOARD_SWATCH_BEAD_DIAMETER_PX,
  LEADERBOARD_SWATCH_DIAMETER_PX,
  LEADERBOARD_SWATCH_RING_WIDTH_PX,
} from './hud-constants';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID, leaderboardRowTestId } from './test-ids';
import { leaderboardEntriesFor, type LeaderboardEntry } from './format/leaderboard-rows';
import { leaderboardSwatchFor, type LeaderboardSwatch } from './format/leaderboard-swatch';

const HALF = 2;
/** The swatch's own square viewBox, centred on the origin, with room for the beads on the rim. */
const SWATCH_VIEW_BOX_RADIUS = LEADERBOARD_SWATCH_DIAMETER_PX;
const SWATCH_BODY_RADIUS = LEADERBOARD_SWATCH_DIAMETER_PX / HALF;
const SWATCH_BEAD_RADIUS = LEADERBOARD_SWATCH_BEAD_DIAMETER_PX / HALF;
const SWATCH_VIEW_BOX = [
  -SWATCH_VIEW_BOX_RADIUS,
  -SWATCH_VIEW_BOX_RADIUS,
  SWATCH_VIEW_BOX_RADIUS * HALF,
  SWATCH_VIEW_BOX_RADIUS * HALF,
].join(' ');

/** One rendered row: the ranking fact plus the seat colours it is drawn in. */
interface LeaderboardViewRow {
  readonly entry: LeaderboardEntry;
  readonly swatch: LeaderboardSwatch;
  readonly testId: string;
}

/** The header, the full list's column labels and the rows: the panel's height at scale 1. */
function panelHeightPx(rowCount: number, isFull: boolean): number {
  const labels = isFull ? LEADERBOARD_LABEL_ROW_HEIGHT_PX : 0;
  return LEADERBOARD_HEADER_HEIGHT_PX + labels + rowCount * LEADERBOARD_ROW_HEIGHT_PX;
}

@Component({
  selector: 'app-leaderboard-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="leaderboard"
      [class.full]="isFull()"
      [style.--hud-leaderboard-height.px]="heightPx()"
      [attr.data-testid]="testId.leaderboard"
    >
      <button
        type="button"
        class="header"
        [attr.data-testid]="testId.leaderboardHeader"
        [attr.aria-expanded]="isFull()"
        (click)="toggleFull()"
      >
        <span class="header-title">Leaderboard</span>
        <span class="header-hint">Tab</span>
      </button>
      @if (isFull()) {
        <!-- The full list's three numeric columns carry no unit, so they are labelled (docs/UI.md §3.1.1). -->
        <div class="column-labels" aria-hidden="true">
          <span class="score">Score</span>
          <span class="mass">Mass</span>
          <span class="absorptions">Eaten</span>
        </div>
      }
      <ol class="rows" [attr.data-testid]="isFull() ? testId.leaderboardFull : null">
        @for (row of rows(); track row.entry.playerId; let slot = $index) {
          <li
            class="row"
            [class.own]="row.entry.isOwn"
            [style.--hud-row-slot]="slot"
            [style.background]="row.entry.isOwn ? row.swatch.ownRowTint : null"
            [attr.data-testid]="row.testId"
          >
            <span class="rank">{{ row.entry.rank }}</span>
            <svg class="swatch" [attr.viewBox]="swatchViewBox" aria-hidden="true" focusable="false">
              <circle
                [attr.r]="swatchBodyRadius"
                [attr.fill]="row.swatch.base"
                [attr.stroke]="row.swatch.rim"
                [attr.stroke-width]="swatchRingWidth"
              />
              @for (bead of row.swatch.beads; track $index) {
                <circle class="bead" [attr.cx]="bead.x" [attr.cy]="bead.y" [attr.r]="swatchBeadRadius" />
              }
            </svg>
            <span class="name">{{ row.entry.name }}</span>
            <span class="level">L{{ row.entry.level }}</span>
            <span class="score">{{ row.entry.score }}</span>
            @if (isFull()) {
              <span class="mass">{{ row.entry.mass }}</span>
              <span class="absorptions">{{ row.entry.absorptions }}</span>
            }
          </li>
        }
      </ol>
    </div>
  `,
  styleUrl: './leaderboard-panel.component.css',
})
export class LeaderboardPanelComponent {
  private readonly gameState = inject(GameStateService);
  private readonly hudState = inject(HudStateService);

  protected readonly testId = HUD_TEST_ID;
  protected readonly swatchViewBox = SWATCH_VIEW_BOX;
  protected readonly swatchBodyRadius = SWATCH_BODY_RADIUS;
  protected readonly swatchBeadRadius = SWATCH_BEAD_RADIUS;
  protected readonly swatchRingWidth = LEADERBOARD_SWATCH_RING_WIDTH_PX;

  protected readonly isFull = this.hudState.isFullLeaderboardOpen;

  private readonly entries = computed(() =>
    leaderboardEntriesFor({
      rows: this.gameState.leaderboard(),
      players: this.gameState.players(),
      avatarAssignments: this.gameState.avatarAssignments(),
      ownPlayerId: this.gameState.ownPlayerId(),
      maxRows: this.isFull() ? LEADERBOARD_FULL_ROWS : LEADERBOARD_COMPACT_ROWS,
    }),
  );

  protected readonly rows = computed<readonly LeaderboardViewRow[]>(() =>
    this.entries().map((entry) => ({
      entry,
      swatch: leaderboardSwatchFor(entry.avatarIndex, SWATCH_BODY_RADIUS),
      testId: leaderboardRowTestId(entry.playerId),
    })),
  );

  protected readonly heightPx = computed(() => panelHeightPx(this.entries().length, this.isFull()));

  protected toggleFull(): void {
    this.hudState.toggleFullLeaderboard();
  }
}
