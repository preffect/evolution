// The in-game cursor (docs/ui/input-and-onboarding.md §4.1, #794): while the pointer is locked the system cursor is
// hidden, so the HUD draws the virtual pointer the cell steers toward. A ring in the text colour on a dark halo with
// a dot at the exact point, code-drawn, still (nothing to reduce under reduced motion), and above every other layer.
// It is a pointer, not chrome: it takes no events and is the one DOM element allowed in the exclusion box
// (docs/ui/layout.md §1), as the system cursor always was.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  VIRTUAL_CURSOR_DOT_RADIUS_PX,
  VIRTUAL_CURSOR_HALO_STROKE_PX,
  VIRTUAL_CURSOR_RING_RADIUS_PX,
  VIRTUAL_CURSOR_RING_STROKE_PX,
} from './hud-constants';
import { MouseLockService } from './mouse-lock.service';
import { HUD_TEST_ID } from '../test-ids/hud-test-ids';

/** Half the drawing's side: the ring and its halo, so nothing is clipped. */
const HALF_SIZE_PX = VIRTUAL_CURSOR_RING_RADIUS_PX + VIRTUAL_CURSOR_HALO_STROKE_PX;
/** The drawing's side, centred on the steering point. */
const SIZE_PX = HALF_SIZE_PX + HALF_SIZE_PX;

@Component({
  selector: 'app-virtual-cursor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (transform(); as cursorTransform) {
      <svg
        class="cursor"
        aria-hidden="true"
        [attr.data-testid]="testId"
        [attr.width]="size"
        [attr.height]="size"
        [attr.viewBox]="viewBox"
        [style.transform]="cursorTransform"
      >
        <circle class="halo" [attr.r]="ringRadius" [attr.stroke-width]="haloStroke" />
        <circle class="ring" [attr.r]="ringRadius" [attr.stroke-width]="ringStroke" />
        <circle class="dot-halo" [attr.r]="dotRadius + ringStroke" />
        <circle class="dot" [attr.r]="dotRadius" />
      </svg>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
        overflow: hidden;
      }
      .cursor {
        position: absolute;
        top: 0;
        left: 0;
        overflow: visible;
      }
      .halo,
      .ring {
        fill: none;
      }
      .halo {
        stroke: var(--ui-callout-backing);
      }
      .dot-halo {
        fill: var(--ui-callout-backing);
        stroke: none;
      }
      .ring {
        stroke: var(--ui-text);
      }
      .dot {
        fill: var(--ui-text);
      }
    `,
  ],
})
export class VirtualCursorComponent {
  private readonly mouseLock = inject(MouseLockService);

  protected readonly testId = HUD_TEST_ID.virtualCursor;
  protected readonly size = SIZE_PX;
  protected readonly viewBox = `${-HALF_SIZE_PX} ${-HALF_SIZE_PX} ${SIZE_PX} ${SIZE_PX}`;
  protected readonly ringRadius = VIRTUAL_CURSOR_RING_RADIUS_PX;
  protected readonly ringStroke = VIRTUAL_CURSOR_RING_STROKE_PX;
  protected readonly haloStroke = VIRTUAL_CURSOR_RING_STROKE_PX + VIRTUAL_CURSOR_HALO_STROKE_PX;
  protected readonly dotRadius = VIRTUAL_CURSOR_DOT_RADIUS_PX;

  /** The drawing centred on the virtual pointer; `null` while the pointer is not locked. */
  protected readonly transform = computed(() => {
    const point = this.mouseLock.cursorPoint();
    return point === null ? null : `translate(${point.x - HALF_SIZE_PX}px, ${point.y - HALF_SIZE_PX}px)`;
  });
}
