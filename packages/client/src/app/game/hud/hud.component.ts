// The HUD shell (docs/UI.md §1, §7): the overlay layer over the canvas. It owns two things —
// `--hud-scale`, read from its own box through the pure `hudScaleFor`, and the rest of the
// `--hud-…` custom properties every child stylesheet reads (`hud-css-variables.ts`) — and hosts
// the chrome. The layer itself never takes the pointer: only the controls inside it opt back in,
// so a click always reaches the dish.
//
// The chrome is the leaderboard and the round clock, nothing else (docs/UI.md §3.1.1); the own-cell
// status mirror (#186), the picker (#188), the death and results overlays (#189) and the notices
// (#190) slot in here as they land.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { LeaderboardPanelComponent } from './leaderboard-panel.component';
import { RoundTimerComponent } from './round-timer.component';
import { HUD_TEST_ID } from './test-ids';
import { hudScaleFor } from './format/hud-scale';
import { hudStyleVariables } from './format/hud-css-variables';
import { observeElementSize, type ElementSize } from './element-size';

const NO_SIZE: ElementSize = { widthPx: 0, heightPx: 0 };

@Component({
  selector: 'app-hud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LeaderboardPanelComponent, RoundTimerComponent],
  template: `
    <app-leaderboard-panel />
    <app-round-timer />
  `,
  host: {
    '[attr.data-testid]': 'testId.hud',
    '[style]': 'styleVariables()',
  },
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        /* The layer never eats a click: the controls inside it set their own pointer-events. */
        pointer-events: none;
        user-select: none;
      }
    `,
  ],
})
export class HudComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly size = signal<ElementSize>(NO_SIZE);
  private stopObservingSize: (() => void) | null = null;

  protected readonly testId = HUD_TEST_ID;

  /** `--hud-scale` (docs/UI.md §1): unitless, so hit-testing and focus rings stay in real pixels. */
  protected readonly scale = computed(() => hudScaleFor(this.size().widthPx, this.size().heightPx));

  /** The scale plus every constant the child stylesheets read, as one style map. */
  protected readonly styleVariables = computed(() => hudStyleVariables(this.scale()));

  ngOnInit(): void {
    this.stopObservingSize = observeElementSize(this.host.nativeElement as HTMLElement, (size) => this.size.set(size));
  }

  ngOnDestroy(): void {
    this.stopObservingSize?.();
    this.stopObservingSize = null;
  }
}
