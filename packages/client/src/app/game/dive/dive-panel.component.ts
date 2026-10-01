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
  effect,
  inject,
  signal,
  viewChild,
  type AfterViewInit,
} from '@angular/core';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { REDUCED_MOTION } from '../reduced-motion';
import {
  DIVE_LADDER,
  DIVE_PHASE_STOPS,
  DIVE_READOUT_CLEARANCE_PX,
  DIVE_SLIDER_STEP,
  DIVE_ZOOM_BOTTOM,
  DIVE_ZOOM_TOP,
  type DivePhaseStop,
} from '../render/constants';
import { diveLabelPlacements, type DiveReadoutKeepOut } from '../render/dive/dive-labels';
import { diveReadout, diveScaleBar, superscript } from '../render/dive/dive-readout';
import { DIVE_SLIDER_MAX, diveSliderPercent, diveSliderValue, diveZoomFromSlider } from '../render/dive/dive-camera';
import { OPENING_DIVE, type DiveFrameState, type DiveHandle } from '../render/dive/dive-host';
import { DIVE_PANEL_TEST_ID } from '../test-ids/dive-test-ids';

/** The keys that skip a playing opening to its stop (`' '` is Space). */
export const DIVE_SKIP_KEYS: readonly string[] = [' ', 'Escape'];

/** The slider's tick row: one power of ten per ladder row the slider reaches, Earth first. */
export const DIVE_LADDER_POWERS: readonly number[] = DIVE_LADDER.map((row) => row.powerOfTen).filter(
  (power) => power >= DIVE_ZOOM_BOTTOM && power <= DIVE_ZOOM_TOP,
);

/** What the stage says when the dive could not open (no WebGL, a coastline missing): the lobby works on without it. */
export const DIVE_UNAVAILABLE_TEXT = 'The opening dive could not load.';

/** "Phase 1 · The dish": a phase button's text and the flag's. */
export function divePhaseTitle(stop: DivePhaseStop): string {
  return `Phase ${stop.phaseNumber} · ${stop.name}`;
}

/** A phase button's text: its title, and "(idea)" for a later chapter not in the plan yet. */
export function divePhaseButtonText(stop: DivePhaseStop): string {
  return stop.isFuture ? `${divePhaseTitle(stop)} (idea)` : divePhaseTitle(stop);
}

/** The readout's box on its stage, and the clearance a label keeps past it. */
export function diveReadoutKeepOut(readout: HTMLElement): DiveReadoutKeepOut {
  return {
    right: readout.offsetLeft + readout.offsetWidth + DIVE_READOUT_CLEARANCE_PX,
    bottom: readout.offsetTop + readout.offsetHeight + DIVE_READOUT_CLEARANCE_PX,
  };
}

/**
 * Whether the dive owns a key: one nothing else handled, aimed at the page itself or at the dive's stage. A key on a
 * lobby control (a button, a field, the slider) is that control's, and one inside the encyclopedia is the
 * encyclopedia's — its Esc closes it and must not skip the dive too.
 */
function isDiveKey(event: KeyboardEvent, stage: HTMLElement): boolean {
  if (event.defaultPrevented || !DIVE_SKIP_KEYS.includes(event.key)) return false;
  const target = event.target;
  if (!(target instanceof Node)) return false;
  const page = stage.ownerDocument;
  return target === page.body || target === page.documentElement || target === page || stage.contains(target);
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
  private readonly readoutElement = viewChild<ElementRef<HTMLElement>>('readout');
  /** The readout's measured box, which the labels keep clear of; the constant's until it is measured. */
  private readonly readoutKeepOut = signal<DiveReadoutKeepOut | undefined>(undefined);
  private handle: DiveHandle | null = null;
  private readonly frame = signal<DiveFrameState | null>(null);
  private readonly isUnavailableValue = signal(false);
  /** The dive could not open: the stage shows `DIVE_UNAVAILABLE_TEXT` and stays still. */
  protected readonly isUnavailable = this.isUnavailableValue.asReadonly();
  protected readonly unavailableText = DIVE_UNAVAILABLE_TEXT;

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
      readout: this.readoutKeepOut(),
    });
  });
  protected readonly scaleBar = computed(() => {
    const frame = this.frame();
    return frame === null || frame.view.camera.pixelsPerMetre <= 0 ? null : diveScaleBar(frame.view.camera);
  });
  protected readonly flag = computed(() => this.frame()?.stopShown ?? null);
  protected readonly isFlagOn = computed(() => this.frame()?.hasArrived ?? false);
  protected readonly isPaused = computed(() => this.frame()?.isPaused ?? false);

  constructor() {
    this.measureReadout();
  }

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
    void this.open(handle);
  }

  /** A dive that fails to open is quiet: the lobby keeps working and the stage says so, never an unhandled error. */
  private async open(handle: DiveHandle): Promise<void> {
    const isOpen = await handle.start().catch(() => false);
    if (!isOpen && this.handle === handle) this.isUnavailableValue.set(true);
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

  /**
   * The readout's box, measured whenever it changes size (its line of words changes with the zoom and wraps on a
   * narrow stage), so the labels keep clear of the box it really has (`ResizeObserver`, where there is one).
   */
  private measureReadout(): void {
    effect((onCleanup) => {
      const readout = this.readoutElement()?.nativeElement;
      const view = readout?.ownerDocument.defaultView;
      if (readout === undefined || view === null || view === undefined || typeof view.ResizeObserver !== 'function') {
        return;
      }
      const observer = new view.ResizeObserver(() => this.readoutKeepOut.set(diveReadoutKeepOut(readout)));
      observer.observe(readout);
      onCleanup(() => observer.disconnect());
    });
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

  /** Space or Esc skips a playing opening to its stop, when the dive owns the key (`isDiveKey`). */
  protected onKeydown(event: KeyboardEvent): void {
    if (!isDiveKey(event, this.stage().nativeElement)) return;
    if (this.handle?.skip() === true) event.preventDefault();
  }
}
