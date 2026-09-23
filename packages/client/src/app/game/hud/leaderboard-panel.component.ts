// The leaderboard (docs/ui/hud.md §3.1.1): top-right, compact by default, the full list with mass and
// absorptions while Tab is held or after the header is clicked. Rows are absolutely placed by their
// slot so a re-sort slides rather than jumps. It decides nothing about who is shown or what a row
// reads — `leaderboardEntriesFor` does — and nothing about the swatch — `leaderboard-swatch.ts`
// does. The stylesheet is the sibling `.css`; every length and colour in it is a `--hud-…` the
// shell publishes from the constants.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { GameStateService } from '../state/game-state.service';
import {
  LEADERBOARD_COMPACT_ROWS,
  LEADERBOARD_FOOTER_ROW_HEIGHT_PX,
  LEADERBOARD_FULL_ROWS,
  LEADERBOARD_HEADER_HEIGHT_PX,
  LEADERBOARD_LABEL_ROW_HEIGHT_PX,
  LEADERBOARD_ROW_HEIGHT_PX,
} from './hud-constants';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID, leaderboardRowTestId } from '../test-ids/hud-test-ids';
import { LEADERBOARD_TEXT, leaderboardLabelsFor } from './format/leaderboard-labels';
import { leaderboardEntriesFor, type LeaderboardEntry } from './format/leaderboard-rows';
import { leaderboardSwatchFor, leaderboardSwatchGeometry, type LeaderboardSwatch } from './format/leaderboard-swatch';

/** The property whose transition the full layout waits for, and the play state of one that has run to its end. */
const WIDTH_PROPERTY = 'width';
const FINISHED_STATE = 'finished';

/** One user unit is one CSS px here, pinned by `leaderboard-swatch.spec.ts`. */
const SWATCH = leaderboardSwatchGeometry();

/** One rendered row: the ranking fact plus the seat colours it is drawn in. */
interface LeaderboardViewRow {
  readonly entry: LeaderboardEntry;
  readonly swatch: LeaderboardSwatch;
  readonly testId: string;
}

/** The header, the label strip, the rows and the full list's footer: the panel's height at scale 1. */
function panelHeightPx(rowCount: number, isFull: boolean): number {
  const footer = isFull ? LEADERBOARD_FOOTER_ROW_HEIGHT_PX : 0;
  return LEADERBOARD_HEADER_HEIGHT_PX + LEADERBOARD_LABEL_ROW_HEIGHT_PX + rowCount * LEADERBOARD_ROW_HEIGHT_PX + footer;
}

@Component({
  selector: 'app-leaderboard-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #panel
      class="leaderboard"
      [class.full]="isFull()"
      [class.full-layout]="isFullLayout()"
      (transitionend)="onTransitionEvent()"
      (transitioncancel)="onTransitionEvent()"
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
        <span class="header-title">{{ text.title }}</span>
        <span class="header-hint">{{ labels().hint }}</span>
      </button>
      <!-- The numeric columns carry no unit, so both panels name them (docs/ui/hud.md §3.1.1, decision #324). -->
      <div class="column-labels" aria-hidden="true" [attr.data-testid]="testId.leaderboardLabels">
        @for (label of labels().columns; track label.className) {
          <span [class]="label.className">{{ label.text }}</span>
        }
      </div>
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
            <span class="score">{{ row.entry.scoreText }}</span>
            @if (isFullLayout()) {
              <span class="mass">{{ row.entry.massText }}</span>
              <span class="absorptions">{{ row.entry.absorptions }}</span>
            }
          </li>
        }
      </ol>
      @if (labels().footer; as footer) {
        <p class="footer" [attr.data-testid]="testId.leaderboardFooter">{{ footer }}</p>
      }
    </div>
  `,
  styleUrl: './leaderboard-panel.component.css',
})
export class LeaderboardPanelComponent {
  private readonly gameState = inject(GameStateService);
  private readonly hudState = inject(HudStateService);

  protected readonly testId = HUD_TEST_ID;
  protected readonly text = LEADERBOARD_TEXT;
  protected readonly swatchViewBox = SWATCH.viewBox;
  protected readonly swatchBodyRadius = SWATCH.bodyRadius;
  protected readonly swatchBeadRadius = SWATCH.beadRadius;
  protected readonly swatchRingWidth = SWATCH.ringWidth;

  protected readonly isFull = this.hudState.isFullLeaderboardOpen;

  /**
   * The full list's columns and footer wait for the panel to finish widening (#615): drawn while the box still grows
   * from the compact width, they were squeezed and clipped for the whole `LEADERBOARD_EXPAND_MS`. Widening, the rows
   * keep the compact columns and the footer stays away; closing, both go at once, before the box narrows. Settled
   * from the running transition itself (`settle`), so a cancelled one can never leave the board wide and compact.
   */
  private readonly isWidthSettledFull = signal(false);
  protected readonly isFullLayout = computed(() => this.isFull() && this.isWidthSettledFull());
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly injector = inject(Injector);

  protected readonly labels = computed(() =>
    leaderboardLabelsFor({
      isFull: this.isFull(),
      isFullLayout: this.isFullLayout(),
      isPinned: this.hudState.isFullLeaderboardPinned(),
      scoreAbsorptionBonus: this.gameState.balance()?.session.SCORE_ABSORPTION_BONUS ?? null,
    }),
  );

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
      swatch: leaderboardSwatchFor(entry.avatarIndex, SWATCH.bodyRadius),
      testId: leaderboardRowTestId(entry.playerId),
    })),
  );

  protected readonly heightPx = computed(() => panelHeightPx(this.entries().length, this.isFull()));

  constructor() {
    // Every change of the held state re-reads the transition once the new width is applied, whatever events follow.
    effect(() => {
      this.isFull();
      afterNextRender(() => this.settle(), { injector: this.injector });
    });
  }

  /** The width transition ended or was cancelled: read what is running now rather than trusting the event (#615). */
  protected onTransitionEvent(): void {
    this.settle();
  }

  /**
   * Settles the layout from the transition's actual state, never from one event: a width transition cancelled by a
   * fast release and re-press, or by the panel being hidden, fires no `transitionend` at all. Closed: compact at once.
   * Open with no width transition running: full now. Open with one running: full when it finishes, or re-checked when
   * it is cancelled.
   */
  private settle(): void {
    if (!this.isFull()) {
      this.isWidthSettledFull.set(false);
      return;
    }
    const transition = this.runningWidthTransition();
    if (transition === null) {
      this.isWidthSettledFull.set(true);
      return;
    }
    this.isWidthSettledFull.set(false);
    transition.finished.then(
      () => this.settle(),
      () => this.settle(),
    );
  }

  /** The panel's own width transition while it runs; `null` once finished, cancelled, or where nothing animates. */
  private runningWidthTransition(): Animation | null {
    const panel = this.panel()?.nativeElement;
    const animations = panel?.getAnimations?.() ?? [];
    return (
      animations.find(
        (animation) =>
          (animation as CSSTransition).transitionProperty === WIDTH_PROPERTY && animation.playState !== FINISHED_STATE,
      ) ?? null
    );
  }

  protected toggleFull(): void {
    this.hudState.toggleFullLeaderboard();
  }
}
