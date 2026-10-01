// The opening dive on the main menu (docs/rendering/opening-dive.md §5, ticket #797): the mockup's viewer — the stage
// with its readout, labels, scale bar and phase flag, then the phase buttons, pause, the scrub slider with its
// powers of ten and phase marks, and Space or Esc to skip. The drawing is the `OPENING_DIVE` handle's; everything
// here is DOM over it, recomputed from the frame the handle reports.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  type AfterViewInit,
} from '@angular/core';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { REDUCED_MOTION } from '../reduced-motion';
import { DIVE_LADDER, DIVE_PHASE_STOPS, DIVE_SLIDER_STEP, type DivePhaseStop } from '../render/constants';
import { diveLabelPlacements } from '../render/dive/dive-labels';
import { diveReadout, diveScaleBar, superscript } from '../render/dive/dive-readout';
import { DIVE_SLIDER_MAX, diveSliderPercent, diveSliderValue, diveZoomFromSlider } from '../render/dive/dive-camera';
import { OPENING_DIVE, type DiveFrameState, type DiveHandle } from '../render/dive/dive-host';

export const DIVE_PANEL_TEST_ID = {
  panel: 'dive-panel',
  stage: 'dive-stage',
  pause: 'dive-pause',
  slider: 'dive-zoom',
  phaseButton: 'dive-phase-',
  readoutFieldOfView: 'dive-readout-fov',
  readoutPower: 'dive-readout-power',
  readoutWhat: 'dive-readout-what',
  flag: 'dive-phase-flag',
  label: 'dive-label',
  scaleBar: 'dive-scale-bar',
} as const;

/** The keys that skip a playing opening to its stop (`' '` is Space). */
export const DIVE_SKIP_KEYS: readonly string[] = [' ', 'Escape'];

/** The slider's tick row: one power of ten per ladder row, Earth first. */
export const DIVE_LADDER_POWERS: readonly number[] = DIVE_LADDER.map((row) => row.powerOfTen);

/** "Phase 1 · The dish": a phase button's text and the flag's. */
export function divePhaseTitle(stop: DivePhaseStop): string {
  return `Phase ${stop.phaseNumber} · ${stop.name}`;
}

/** A phase button's text: its title, and "(idea)" for a later chapter not in the plan yet. */
export function divePhaseButtonText(stop: DivePhaseStop): string {
  return stop.isFuture ? `${divePhaseTitle(stop)} (idea)` : divePhaseTitle(stop);
}

/** An element whose keys belong to the reader's typing, never to the dive. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

@Component({
  selector: 'app-dive-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dive-panel.component.css',
  host: { '(window:keydown)': 'onKeydown($event)' },
  templateUrl: './dive-panel.component.html',
})
export class DivePanelComponent implements AfterViewInit {
  private readonly diveFactory = inject(OPENING_DIVE);
  private readonly isMotionReduced = inject(REDUCED_MOTION);
  private readonly destroyReference = inject(DestroyRef);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private handle: DiveHandle | null = null;
  private readonly frame = signal<DiveFrameState | null>(null);

  protected readonly testId = DIVE_PANEL_TEST_ID;
  protected readonly stops = DIVE_PHASE_STOPS;
  protected readonly sliderMax = DIVE_SLIDER_MAX;
  protected readonly sliderStep = DIVE_SLIDER_STEP;
  protected readonly phaseTitle = divePhaseTitle;
  protected readonly buttonText = divePhaseButtonText;
  protected readonly ticks = DIVE_LADDER_POWERS.map((power) => ({
    text: `10${superscript(power)}`,
    leftPercent: diveSliderPercent(power),
  }));
  protected readonly marks = DIVE_PHASE_STOPS.map((stop) => ({ stop, leftPercent: diveSliderPercent(stop.zoom) }));

  protected readonly zoom = computed(() => this.frame()?.view.camera.zoom ?? null);
  protected readonly readout = computed(() => {
    const zoom = this.zoom();
    return zoom === null ? null : diveReadout(zoom);
  });
  protected readonly sliderValue = computed(() => {
    const zoom = this.zoom();
    return zoom === null ? 0 : diveSliderValue(zoom);
  });
  protected readonly labels = computed(() => {
    const frame = this.frame();
    if (frame === null) return [];
    const { view } = frame;
    return diveLabelPlacements({
      camera: view.camera,
      globeRotation: view.globeRotation,
      worldWeight: view.bands.shore.weight,
    });
  });
  protected readonly scaleBar = computed(() => {
    const frame = this.frame();
    return frame === null || frame.view.camera.pixelsPerMetre <= 0 ? null : diveScaleBar(frame.view.camera);
  });
  protected readonly flag = computed(() => this.frame()?.stopShown ?? null);
  protected readonly isFlagOn = computed(() => this.frame()?.hasArrived ?? false);
  protected readonly isPaused = computed(() => this.frame()?.isPaused ?? false);

  ngAfterViewInit(): void {
    const host = this.stage().nativeElement;
    const handle = this.diveFactory({
      host,
      balance: () => DEFAULT_BALANCE,
      isMotionReduced: () => this.isMotionReduced(),
      onFrame: (state) => this.frame.set(state),
    });
    this.handle = handle;
    this.destroyReference.onDestroy(() => {
      this.handle = null;
      handle.destroy();
    });
    this.observeVisibility(host, handle);
    void handle.start();
  }

  /** The dive stops drawing while its stage is scrolled out of view (`IntersectionObserver`, where there is one). */
  private observeVisibility(host: HTMLElement, handle: DiveHandle): void {
    const view = host.ownerDocument.defaultView;
    if (view === null || typeof view.IntersectionObserver !== 'function') return;
    const observer = new view.IntersectionObserver((entries) => {
      handle.setIsVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(host);
    this.destroyReference.onDestroy(() => observer.disconnect());
  }

  protected play(stop: DivePhaseStop): void {
    this.handle?.playPhase(stop, this.isMotionReduced());
  }

  protected togglePause(): void {
    this.handle?.togglePause();
  }

  protected onScrub(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.handle?.scrub(diveZoomFromSlider(value));
  }

  /** Space or Esc skips a playing opening to its stop; never while the reader types. */
  protected onKeydown(event: KeyboardEvent): void {
    if (!DIVE_SKIP_KEYS.includes(event.key) || isTypingTarget(event.target)) return;
    if (this.handle?.skip() === true) event.preventDefault();
  }
}
