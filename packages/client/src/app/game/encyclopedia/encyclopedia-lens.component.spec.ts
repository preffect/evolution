// The lens (docs/ui/encyclopedia.md §11.4).
//
// **What jsdom can and cannot hold here.** It has no layout, no user-agent cascade and no GL, so nothing below
// claims the lens is round, is 300 px, or shows a scene: those are the rendered frames' to answer and the PR's
// screenshots are where they are answered. What a spec can hold is what is in the DOM per state, that the crop is
// the rounded overflow §12.7 asks for rather than the `clip-path` it forbids, and that the one canvas moves into
// this stage and back out again instead of being opened afresh per page.

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_SCALE_MAX } from '../../ui-kit/ui-kit-constants';
import { PREVIEW_CANVAS_MAX_PX, PREVIEW_MAX_DEVICE_PIXEL_RATIO } from '../render/constants/preview';
import { ENCYCLOPEDIA_PREVIEW } from '../render/preview/preview-host';
import { recordingPreviewHost } from '../../../testing/fake-preview-handle';
import { expectTestId } from '../../../testing/test-id-query';
import { hostSelector, styleRuleValue } from '../../../testing/style-rules';
import {
  ENCYCLOPEDIA_LENS_DIAMETER_PX,
  ENCYCLOPEDIA_LENS_TICK_COUNT,
  ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT,
} from './encyclopedia-constants';
import { EncyclopediaLensComponent } from './encyclopedia-lens.component';
import {
  ENCYCLOPEDIA_PREVIEW_STATE,
  EncyclopediaPreviewService,
  type EncyclopediaPreviewState,
} from './encyclopedia-preview.service';
import { ENCYCLOPEDIA_TEST_ID } from './test-ids';

/** A host, so the lens can be destroyed on its own and the borrowed canvas watched across that. */
@Component({
  standalone: true,
  imports: [EncyclopediaLensComponent],
  template: `
    @if (isShown()) {
      <app-encyclopedia-lens [state]="state()" />
    }
  `,
})
class LensHostComponent {
  readonly state = signal<EncyclopediaPreviewState>(ENCYCLOPEDIA_PREVIEW_STATE.loading);
  readonly isShown = signal(true);
}

describe('EncyclopediaLensComponent (docs/ui/encyclopedia.md §11.4)', () => {
  let fixture: ComponentFixture<LensHostComponent>;
  let preview: EncyclopediaPreviewService;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function lens(): HTMLElement {
    return expectTestId(root(), ENCYCLOPEDIA_TEST_ID.preview);
  }

  function show(state: EncyclopediaPreviewState): void {
    fixture.componentInstance.state.set(state);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LensHostComponent],
      providers: [
        { provide: ENCYCLOPEDIA_PREVIEW, useValue: recordingPreviewHost().factory },
        EncyclopediaPreviewService,
      ],
    });
    fixture = TestBed.createComponent(LensHostComponent);
    preview = TestBed.inject(EncyclopediaPreviewService);
    fixture.detectChanges();
  });

  it('carries the preview id and the state it is given', () => {
    expect(lens().dataset['previewState']).toBe(ENCYCLOPEDIA_PREVIEW_STATE.loading);
    show(ENCYCLOPEDIA_PREVIEW_STATE.live);
    expect(lens().dataset['previewState']).toBe(ENCYCLOPEDIA_PREVIEW_STATE.live);
  });

  it('takes the preview’s canvas into its stage, and gives it back when it goes', () => {
    const stage = lens().querySelector('.stage');
    expect(preview.hostElement.parentElement).toBe(stage);

    fixture.componentInstance.isShown.set(false);
    fixture.detectChanges();
    expect(preview.hostElement.parentElement).toBeNull();
  });

  /** The eyepiece is drawn once and never per state: the ticks are there whether or not a scene is. */
  it('draws the rim, the inner ring and every reticle tick', () => {
    const overlay = lens().querySelector('.overlay');
    expect(overlay?.querySelectorAll('.tick')).toHaveLength(ENCYCLOPEDIA_LENS_TICK_COUNT);
    expect(overlay?.querySelector('.rim')).not.toBeNull();
    expect(overlay?.querySelector('.inner-ring')).not.toBeNull();
    expect(overlay?.querySelector('radialGradient')).not.toBeNull();
  });

  it('pulses a ring while loading, and only while loading', () => {
    expect(lens().querySelector('.loading-ring')).not.toBeNull();
    show(ENCYCLOPEDIA_PREVIEW_STATE.live);
    expect(lens().querySelector('.loading-ring')).toBeNull();
  });

  it('says so, in §11.7’s words, when the preview could not start — and never otherwise', () => {
    expect(lens().querySelector('.unavailable')).toBeNull();
    show(ENCYCLOPEDIA_PREVIEW_STATE.unavailable);
    expect(lens().querySelector('.unavailable')?.textContent?.trim()).toBe(ENCYCLOPEDIA_PREVIEW_UNAVAILABLE_TEXT);
  });

  /**
   * §12.7 chooses the crop deliberately: a rounded overflow clip is applied as the compositor draws the canvas
   * quad, while a `clip-path` promotes the canvas to its own layer with an offscreen surface of up to its size.
   * Both halves are asserted, since `overflow: hidden` without the radius is a square lens.
   */
  it('crops with a rounded overflow rather than a clip-path', () => {
    const stage = ['.stage'];
    expect(styleRuleValue(root().ownerDocument, stage, 'border-radius')).toBe('50%');
    expect(styleRuleValue(root().ownerDocument, stage, 'overflow')).toBe('hidden');
    expect(styleRuleValue(root().ownerDocument, stage, 'clip-path')).toBeNull();
  });

  it('lets a press through to what is under it, never to the drawing over it', () => {
    expect(styleRuleValue(root().ownerDocument, ['.overlay'], 'pointer-events')).toBe('none');
  });

  it('is the diameter square, at the scale the panel is drawn at', () => {
    const size = `calc(var(--encyclopedia-lens-diameter) * var(--ui-scale))`;
    const selector = [hostSelector(lens())];
    expect(styleRuleValue(root().ownerDocument, selector, 'width')).toBe(size);
    expect(styleRuleValue(root().ownerDocument, selector, 'height')).toBe(size);
  });

  /**
   * #373's pin, from the encyclopedia side (docs/architecture/encyclopedia.md §12.7). The canvas is the lens's
   * bounding square in CSS px, and the session clamps each side to `PREVIEW_CANVAS_MAX_PX` **device** pixels — so
   * the widest canvas the encyclopedia can ask for is the diameter at the kit's largest scale, at the preview's DPR
   * cap. It holds today with **no headroom** (300 × 1.5 × 2 = 900), which is why it is pinned: raising any of the
   * three by any amount would not stretch the lens, it would silently shrink the scene inside it.
   */
  it('never asks for a canvas the preview would have to clamp', () => {
    const widestDevicePx = ENCYCLOPEDIA_LENS_DIAMETER_PX * UI_SCALE_MAX * PREVIEW_MAX_DEVICE_PIXEL_RATIO;
    expect(widestDevicePx).toBeLessThanOrEqual(PREVIEW_CANVAS_MAX_PX);
  });
});
