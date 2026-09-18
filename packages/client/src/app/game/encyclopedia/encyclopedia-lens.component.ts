// The lens (docs/ui/encyclopedia.md §11.4): the round window the entry page's preview plays in. Three layers, bottom
// to top — the square stage the preview canvas lives in, clipped to a circle; the state the lens is in, drawn inside
// that circle; and the eyepiece's own SVG overlay, which takes no pointer.
//
// **It borrows the canvas rather than owning it.** `EncyclopediaPreviewService` holds the one session an open
// encyclopedia has, and its host element moves into this stage on init and back out on destroy, so a reader who
// steps out to a landing and back does not pay the bundle bake again (§12.7's cost table).
//
// **The crop is a rounded overflow, never a `clip-path`** (§12.7): a clip-path promotes the canvas to its own
// composited layer with an offscreen surface of up to the canvas's size, while a rounded overflow clip is applied as
// the compositor draws the canvas quad. The square's corners are still rendered; they are simply not shown.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { nextUiElementId } from '../../ui-kit/ui-element-id';
import { ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT } from './encyclopedia-constants';
import {
  ENCYCLOPEDIA_PREVIEW_STATE,
  EncyclopediaPreviewService,
  type EncyclopediaPreviewState,
} from './encyclopedia-preview.service';
import { ENCYCLOPEDIA_LENS_OVERLAY } from './format/lens-overlay';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

@Component({
  selector: 'app-encyclopedia-lens',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './encyclopedia-lens.component.css',
  host: { '[attr.data-testid]': 'testId.preview', '[attr.data-preview-state]': 'state()' },
  template: `
    <div class="stage" #stage></div>
    @if (state() === previewState.unavailable) {
      <p class="unavailable">
        <span>{{ unavailableText }}</span>
      </p>
    }
    <svg class="overlay" [attr.viewBox]="overlay.viewBox" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient [attr.id]="vignetteId">
          <stop class="vignette-clear" [attr.offset]="overlay.vignetteStartOffset" />
          <stop class="vignette-edge" offset="1" [attr.stop-opacity]="overlay.vignetteOpacity" />
        </radialGradient>
      </defs>
      <circle
        [attr.cx]="overlay.centre"
        [attr.cy]="overlay.centre"
        [attr.r]="overlay.radius"
        [attr.fill]="vignetteFill"
      />
      @if (state() === previewState.loading) {
        <circle
          class="loading-ring"
          [attr.cx]="overlay.centre"
          [attr.cy]="overlay.centre"
          [attr.r]="overlay.loadingRingRadius"
          [attr.stroke-width]="overlay.hairlineWidth"
        />
      }
      @for (tick of overlay.ticks; track $index) {
        <line
          class="tick"
          [attr.x1]="tick.x1"
          [attr.y1]="tick.y1"
          [attr.x2]="tick.x2"
          [attr.y2]="tick.y2"
          [attr.stroke-width]="overlay.hairlineWidth"
          [attr.stroke-opacity]="overlay.tickOpacity"
        />
      }
      <circle
        class="inner-ring"
        [attr.cx]="overlay.centre"
        [attr.cy]="overlay.centre"
        [attr.r]="overlay.innerRingRadius"
        [attr.stroke-width]="overlay.hairlineWidth"
        [attr.stroke-opacity]="overlay.innerRingOpacity"
      />
      <circle
        class="rim"
        [attr.cx]="overlay.centre"
        [attr.cy]="overlay.centre"
        [attr.r]="overlay.rimRadius"
        [attr.stroke-width]="overlay.rimWidth"
      />
    </svg>
  `,
})
export class EncyclopediaLensComponent implements AfterViewInit, OnDestroy {
  private readonly preview = inject(EncyclopediaPreviewService);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');

  /**
   * What the lens is showing. An input rather than a read of the service, so this component draws what it is told
   * and a spec can hold it in any of the four states without a preview session behind it.
   */
  readonly state = input.required<EncyclopediaPreviewState>();

  protected readonly testId = ENCYCLOPEDIA_TEST_ID;
  protected readonly previewState = ENCYCLOPEDIA_PREVIEW_STATE;
  protected readonly overlay = ENCYCLOPEDIA_LENS_OVERLAY;
  protected readonly unavailableText = ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT;

  /** One gradient per instance: two lenses in one document must not share a `<defs>` id. */
  protected readonly vignetteId = nextUiElementId('encyclopedia-lens-vignette');
  protected readonly vignetteFill = `url(#${this.vignetteId})`;

  /** Where the host element sat before this lens took it, so it is given back rather than simply abandoned. */
  private hostParentBeforeAdoption: ParentNode | null = null;

  ngAfterViewInit(): void {
    const { hostElement } = this.preview;
    this.hostParentBeforeAdoption = hostElement.parentNode;
    this.stage().nativeElement.append(hostElement);
    this.preview.attachStage();
  }

  ngOnDestroy(): void {
    this.preview.detachStage();
    const parent = this.hostParentBeforeAdoption;
    // The first lens of an open takes a host that was nowhere, and gives it back to nowhere rather than leaving it
    // inside a stage this component is about to take off the page with it.
    if (parent === null) this.preview.hostElement.remove();
    else parent.appendChild(this.preview.hostElement);
    this.hostParentBeforeAdoption = null;
  }
}
