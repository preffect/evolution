// The dive panel (docs/rendering/opening-dive.md §5) over a recording `OPENING_DIVE`: what the controls ask of the
// dive, and what the DOM shows from a frame the dive reports. No Pixi, no canvas.

import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideRecordingDive, type RecordingDiveHandle } from '../../../testing/fake-dive-handle';
import { REDUCED_MOTION } from '../reduced-motion';
import { DIVE_PHASE_STOPS, type DivePhaseStop } from '../render/constants';
import { DIVE_PANEL_TEST_ID, DIVE_UNAVAILABLE_TEXT, DivePanelComponent } from './dive-panel.component';

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
    expect(labels.map((label) => (label as HTMLElement).textContent)).toContain('EURASIA');
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

  /** A key pressed with focus on `target` (the page's body when nothing has focus), bubbling to the window. */
  const press = (target: EventTarget, key: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it('skips on Space or Esc aimed at the page or the dive’s stage, taking the key', () => {
    handle.isSkippable = true;
    const space = press(document.body, ' ');
    expect(handle.skipCount).toBe(1);
    expect(space.defaultPrevented).toBe(true);
    press(find(DIVE_PANEL_TEST_ID.stage)!, 'Escape');
    expect(handle.skipCount).toBe(2);
    press(document.body, 'a');
    expect(handle.skipCount).toBe(2);
  });

  it('leaves the key to a lobby control, a field, or whatever already handled it (the encyclopedia’s Esc)', () => {
    handle.isSkippable = true;
    const field = document.createElement('input');
    const lobbyButton = document.createElement('button');
    const encyclopedia = document.createElement('section');
    document.body.append(field, lobbyButton, encyclopedia);
    const onButton = press(lobbyButton, ' ');
    press(field, ' ');
    press(find(`${DIVE_PANEL_TEST_ID.phaseButton}1`)!, ' ');
    press(encyclopedia, 'Escape');
    encyclopedia.addEventListener('keydown', (event) => event.preventDefault());
    press(document.body.appendChild(document.createElement('div')), 'Escape');
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    field.remove();
    lobbyButton.remove();
    encyclopedia.remove();
    expect(handle.skipCount).toBe(0);
    expect(onButton.defaultPrevented).toBe(false);
  });

  it('lets a Space through to the page when nothing was playing', () => {
    const space = press(document.body, ' ');
    expect(handle.skipCount).toBe(1);
    expect(space.defaultPrevented).toBe(false);
  });

  it('names the slider’s place by the field of view, not by its offset', () => {
    handle.emitFrame(-4.3);
    fixture.detectChanges();
    expect(find(DIVE_PANEL_TEST_ID.slider)!.getAttribute('aria-valuetext')).toBe('50 µm');
  });

  it('writes the labels as the script has them: no CSS capitals to turn µ into M', () => {
    handle.emitFrame(7.3);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector(`[data-testid="${DIVE_PANEL_TEST_ID.label}"]`) as HTMLElement;
    expect(label).not.toBeNull();
    expect(getComputedStyle(label).textTransform).not.toBe('uppercase');
  });
});

/** The panel's open settles on a promise of its own, outside Angular's: a macrotask is past it. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('DivePanelComponent when the dive cannot open', () => {
  for (const [name, outcome] of [
    ['answers false', false],
    ['rejects', new Error('no WebGL')],
  ] as const) {
    it(`says so quietly on the stage when the dive ${name}`, async () => {
      const dive = provideRecordingDive(outcome);
      TestBed.configureTestingModule({
        imports: [DivePanelComponent],
        providers: [dive.provider, { provide: REDUCED_MOTION, useValue: signal(false).asReadonly() }],
      });
      const fixture = TestBed.createComponent(DivePanelComponent);
      fixture.detectChanges();
      await settled();
      fixture.detectChanges();
      const note = fixture.nativeElement.querySelector(`[data-testid="${DIVE_PANEL_TEST_ID.unavailable}"]`);
      expect(note?.textContent?.trim()).toBe(DIVE_UNAVAILABLE_TEXT);
    });
  }

  it('says nothing when it opens', async () => {
    const dive = provideRecordingDive();
    TestBed.configureTestingModule({
      imports: [DivePanelComponent],
      providers: [dive.provider, { provide: REDUCED_MOTION, useValue: signal(false).asReadonly() }],
    });
    const fixture = TestBed.createComponent(DivePanelComponent);
    fixture.detectChanges();
    await settled();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(`[data-testid="${DIVE_PANEL_TEST_ID.unavailable}"]`)).toBeNull();
  });
});

describe('DivePanelComponent off screen', () => {
  it('tells the dive when its stage leaves and comes back into view', () => {
    const observers: { callback: IntersectionObserverCallback; observed: Element[]; isDisconnected: boolean }[] = [];
    class RecordingObserver {
      private readonly record: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, observed: [], isDisconnected: false };
        observers.push(this.record);
      }
      observe(target: Element): void {
        this.record.observed.push(target);
      }
      disconnect(): void {
        this.record.isDisconnected = true;
      }
    }
    const previous = window.IntersectionObserver;
    window.IntersectionObserver = RecordingObserver as unknown as typeof IntersectionObserver;
    try {
      const dive = provideRecordingDive();
      TestBed.configureTestingModule({
        imports: [DivePanelComponent],
        providers: [dive.provider, { provide: REDUCED_MOTION, useValue: signal(false).asReadonly() }],
      });
      const fixture = TestBed.createComponent(DivePanelComponent);
      fixture.detectChanges();
      const [observer] = observers;
      const stage = fixture.nativeElement.querySelector(`[data-testid="${DIVE_PANEL_TEST_ID.stage}"]`);
      expect(observer!.observed).toEqual([stage]);
      const entry = (isIntersecting: boolean) => [{ isIntersecting } as IntersectionObserverEntry];
      observer!.callback(entry(false), observer as unknown as IntersectionObserver);
      observer!.callback(entry(true), observer as unknown as IntersectionObserver);
      expect(dive.handles[0]!.visibility).toEqual([false, true]);
      fixture.destroy();
      expect(observer!.isDisconnected).toBe(true);
    } finally {
      window.IntersectionObserver = previous;
    }
  });
});
