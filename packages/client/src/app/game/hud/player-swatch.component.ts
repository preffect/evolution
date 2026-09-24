// A player's seat swatch (docs/ui/hud.md §3.1.1): the seat's palette base inside its rim ring, with the seat-mark
// beads on the outline. One drawing for every place a player is named by colour — the leaderboard rows and the round
// results (docs/ui/overlays.md §3.4) — so the two can never draw a seat differently. The host sizes it: the
// leaderboard's `--hud-leaderboard-swatch-size` unless the host sets `--hud-swatch-size`.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { leaderboardSwatchFor, leaderboardSwatchGeometry } from './format/leaderboard-swatch';

/** One user unit is one CSS px at the leaderboard size, pinned by `leaderboard-swatch.spec.ts`. */
const SWATCH = leaderboardSwatchGeometry();

@Component({
  selector: 'app-player-swatch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="swatch" [attr.viewBox]="viewBox" aria-hidden="true" focusable="false">
      <circle
        [attr.r]="bodyRadius"
        [attr.fill]="swatch().base"
        [attr.stroke]="swatch().rim"
        [attr.stroke-width]="ringWidth"
      />
      @for (bead of swatch().beads; track $index) {
        <circle class="bead" [attr.cx]="bead.x" [attr.cy]="bead.y" [attr.r]="beadRadius" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        width: calc(var(--hud-swatch-size, var(--hud-leaderboard-swatch-size)) * var(--ui-scale));
        height: calc(var(--hud-swatch-size, var(--hud-leaderboard-swatch-size)) * var(--ui-scale));
      }

      .swatch {
        display: block;
        width: 100%;
        height: 100%;
        /* The beads sit on the disc's outline and are wider than it, so they paint outside the viewBox. */
        overflow: visible;
      }

      /* The seat-mark bead core is the one white (docs/visual-style/principles-and-palette.md §2). */
      .bead {
        fill: var(--ui-white);
      }
    `,
  ],
})
export class PlayerSwatchComponent {
  /** The seat index: its palette and its bead count (docs/visual-style/principles-and-palette.md §2). */
  readonly avatarIndex = input.required<number>();

  protected readonly viewBox = SWATCH.viewBox;
  protected readonly bodyRadius = SWATCH.bodyRadius;
  protected readonly beadRadius = SWATCH.beadRadius;
  protected readonly ringWidth = SWATCH.ringWidth;

  protected readonly swatch = computed(() => leaderboardSwatchFor(this.avatarIndex(), SWATCH.bodyRadius));
}
