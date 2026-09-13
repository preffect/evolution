// The status mirror (docs/UI.md §3.1.4): one visually hidden element that carries everything the
// own cell is saying, as `data-*` attributes a Playwright run reads and as a sentence assistive
// technology hears. It is the accessibility half of indicators that are otherwise drawn in WebGL,
// where a screen reader and a DOM assertion can both see nothing at all.
//
// It decides nothing: `formatOwnCellStatus` owns the attributes, the sentence and the rule for
// when the sentence may change. The component holds one piece of state — the last sentence it
// announced — because "has this changed enough to be worth speaking" is a question about history,
// and a computed cannot answer it.
//
// Never `display: none` and never `hidden`: both take the element out of the accessibility tree,
// which is the one thing this element exists to be in.

import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { GameStateService } from '../state/game-state.service';
import { HUD_TEST_ID } from './test-ids';
import { formatOwnCellStatus, shouldAnnounce, type OwnCellStatus } from './format/own-cell-status';

@Component({
  selector: 'app-own-cell-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status(); as current) {
      <div
        class="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        [attr.data-testid]="testId.ownCell"
        [attr.data-level]="current.attributes['data-level']"
        [attr.data-max-level]="current.attributes['data-max-level']"
        [attr.data-dna-percent]="current.attributes['data-dna-percent']"
        [attr.data-ladder]="current.attributes['data-ladder']"
        [attr.data-sprint]="current.attributes['data-sprint']"
        [attr.data-mass]="current.attributes['data-mass']"
        [attr.data-traits]="current.attributes['data-traits']"
        [attr.data-engulfed]="current.attributes['data-engulfed']"
        [attr.data-engulf-phase]="current.attributes['data-engulf-phase']"
        [attr.data-threat]="current.attributes['data-threat']"
        [attr.data-aerobic]="current.attributes['data-aerobic']"
        [attr.data-photosynthetic]="current.attributes['data-photosynthetic']"
      >
        {{ announcedText() }}
      </div>
    }
  `,
  styles: [
    `
      /* The clip pattern: present to assistive technology and to a DOM query, absent on screen.
         display:none, the hidden attribute and visibility:hidden would each take the element out
         of the accessibility tree, which is the one place it exists to be. */
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class OwnCellStatusComponent {
  private readonly gameState = inject(GameStateService);

  protected readonly testId = HUD_TEST_ID;

  /** `null` while spectating or before the first snapshot: nothing to mirror, so nothing renders. */
  protected readonly status = computed<OwnCellStatus | null>(() => {
    const indicators = this.gameState.ownCellIndicators();
    return indicators === null ? null : formatOwnCellStatus(indicators);
  });

  /**
   * The sentence in the DOM. The attributes above update every snapshot; this changes only when
   * `shouldAnnounce` says something a player would want told has moved (docs/UI.md §3.1.4), so
   * `aria-live` fires on a level, a counter, a threat or a phase, and never on drifting mass.
   *
   * A `linkedSignal` rather than an effect: the decision needs the previous value, which a plain
   * computed cannot see and an effect could only reach by writing a second signal. Comparing
   * against the previous *status*'s key is the same as comparing against the last announced one,
   * because the key changes only when we announce — that is what `announceKey` is for.
   */
  protected readonly announcedText = linkedSignal<OwnCellStatus | null, string>({
    source: () => this.status(),
    computation: (current, previous) => {
      if (current === null) return '';
      if (previous === undefined) return current.text;
      return shouldAnnounce(previous.source?.announceKey ?? null, current) ? current.text : previous.value;
    },
  });
}
