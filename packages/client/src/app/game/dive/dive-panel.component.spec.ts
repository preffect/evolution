// The dive panel (docs/rendering/opening-dive.md §5) over a recording `OPENING_DIVE`: what the controls ask of the
// dive, and what the DOM shows from a frame the dive reports. No Pixi, no canvas.

import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideRecordingDive, type RecordingDiveHandle } from '../../../testing/fake-dive-handle';
import { REDUCED_MOTION } from '../reduced-motion';
import { DIVE_PHASE_STOPS, type DivePhaseStop } from '../render/constants';
import { DIVE_PANEL_TEST_ID, DivePanelComponent } from './dive-panel.component';

const SHORE = DIVE_PHASE_STOPS[4] as DivePhaseStop;

describe('DivePanelComponent', () => {
  let fixture: ComponentFixture<DivePanelComponent>;
  let handle: RecordingDiveHandle;
  const isMotionReduced = signal(false);

  const find = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const text = (testId: string): string => find(testId)?.textContent?.trim() ?? '';

  beforeEach(() => {
    isMotionReduced.set(false);
    const dive = provideRecordingDive();
    TestBed.configureTestingModule({
      imports: [DivePanelComponent],
      providers: [dive.provider, { provide: REDUCED_MOTION, useValue: isMotionReduced.asReadonly() }],
    });
    fixture = TestBed.createComponent(DivePanelComponent);
    fixture.detectChanges();
    handle = dive.handles[0]!;
  });

  it('opens the dive on its stage and closes it with the panel', () => {
    expect(handle.startCount).toBe(1);
    expect(handle.options.host).toBe(find(DIVE_PANEL_TEST_ID.stage));
    fixture.destroy();
    expect(handle.destroyCount).toBe(1);
  });

  it('plays a phase’s opening from its button, with the reader’s motion preference', () => {
    find(`${DIVE_PANEL_TEST_ID.phaseButton}5`)!.click();
    isMotionReduced.set(true);
    find(`${DIVE_PANEL_TEST_ID.phaseButton}1`)!.click();
    expect(handle.played).toEqual([
      { stop: SHORE, isMotionReduced: false },
      { stop: DIVE_PHASE_STOPS[0], isMotionReduced: true },
    ]);
  });

  it('marks the later chapters as ideas', () => {
    expect(text(`${DIVE_PANEL_TEST_ID.phaseButton}4`)).toBe('Phase 4 · Tide pool (idea)');
    expect(find(`${DIVE_PANEL_TEST_ID.phaseButton}4`)!.classList.contains('future')).toBe(true);
    expect(text(`${DIVE_PANEL_TEST_ID.phaseButton}1`)).toBe('Phase 1 · The dish');
  });

  it('scrubs to the zoom under the slider: Earth on the left, the cell on the right', () => {
    const slider = find(DIVE_PANEL_TEST_ID.slider) as HTMLInputElement;
    slider.value = '11.7';
    slider.dispatchEvent(new Event('input'));
    expect(handle.scrubs).toHaveLength(1);
    expect(handle.scrubs[0]).toBeCloseTo(-4.3, 9);
  });

  it('pauses and resumes, its label following the dive', () => {
    find(DIVE_PANEL_TEST_ID.pause)!.click();
    expect(handle.pauseToggles).toBe(1);
    handle.emitFrame(2, { isPlaying: true, isPaused: true });
    fixture.detectChanges();
    expect(text(DIVE_PANEL_TEST_ID.pause)).toBe('Resume');
    handle.emitFrame(2, { isPlaying: true, isPaused: false });
    fixture.detectChanges();
    expect(text(DIVE_PANEL_TEST_ID.pause)).toBe('Pause');
  });

  it('writes the readout, the scale bar and the slider from the frame the dive reports', () => {
    handle.emitFrame(-4.3);
    fixture.detectChanges();
    expect(text(DIVE_PANEL_TEST_ID.readoutFieldOfView)).toBe('50 µm');
    expect(text(DIVE_PANEL_TEST_ID.readoutPower)).toBe('field of view ≈ 10⁻⁴ m');
    expect(text(DIVE_PANEL_TEST_ID.readoutWhat)).toContain('the dish');
    expect(text(DIVE_PANEL_TEST_ID.scaleBar)).toBe('5 µm');
    expect(Number((find(DIVE_PANEL_TEST_ID.slider) as HTMLInputElement).value)).toBeCloseTo(11.7, 6);
  });

  it('labels what is on screen', () => {
    handle.emitFrame(7.3);
    fixture.detectChanges();
    const labels = [...fixture.nativeElement.querySelectorAll(`[data-testid="${DIVE_PANEL_TEST_ID.label}"]`)];
    expect(labels.map((label) => (label as HTMLElement).textContent)).toContain('Eurasia');
  });

  it('raises the phase flag in the stop’s colour once the dive arrives', () => {
    handle.emitFrame(1.1, { stopShown: SHORE, hasArrived: false, isPlaying: true });
    fixture.detectChanges();
    expect(find(DIVE_PANEL_TEST_ID.flag)!.classList.contains('on')).toBe(false);
    handle.emitFrame(1.1, { stopShown: SHORE, hasArrived: true });
    fixture.detectChanges();
    const flag = find(DIVE_PANEL_TEST_ID.flag)!;
    expect(flag.classList.contains('on')).toBe(true);
    expect(flag.textContent?.trim()).toBe('Phase 5 · The shore');
    expect(flag.style.color).toBe('rgb(233, 138, 107)');
  });

  it('skips on Space or Esc, and never while the reader types', () => {
    handle.isSkippable = true;
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    window.dispatchEvent(space);
    expect(handle.skipCount).toBe(1);
    expect(space.defaultPrevented).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handle.skipCount).toBe(2);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    const field = document.createElement('input');
    document.body.append(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    field.remove();
    expect(handle.skipCount).toBe(2);
  });

  it('lets a Space through to the page when nothing was playing', () => {
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    window.dispatchEvent(space);
    expect(handle.skipCount).toBe(1);
    expect(space.defaultPrevented).toBe(false);
  });
});
