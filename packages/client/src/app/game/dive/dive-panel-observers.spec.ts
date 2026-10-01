// The dive panel's observers (docs/rendering/opening-dive.md §5, ticket #805), over a recording `OPENING_DIVE` and a
// recording observer in place of the page's: the stage scrolled out of view, the stage changing size on its own, the
// readout's box and each label's box as rendered.

import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideRecordingDive } from '../../../testing/fake-dive-handle';
import { withRecordingObserver, type RecordedObserver } from '../../../testing/recording-observer';
import { REDUCED_MOTION } from '../reduced-motion';
import { DIVE_GEO_LABELS, DIVE_WORLD_LABELS } from '../render/constants';
import { DIVE_PANEL_TEST_ID } from '../test-ids/dive-test-ids';
import { DivePanelComponent } from './dive-panel.component';
import { diveReadoutKeepOut } from './dive-stage-measures';

/** A panel of its own over a recording dive, for the specs that install an observer before it is made. */
function panelOverRecordingDive() {
  const dive = provideRecordingDive();
  TestBed.configureTestingModule({
    imports: [DivePanelComponent],
    providers: [dive.provider, { provide: REDUCED_MOTION, useValue: signal(false).asReadonly() }],
  });
  const fixture = TestBed.createComponent(DivePanelComponent);
  fixture.detectChanges();
  return { fixture, handle: dive.handles[0]! };
}

describe('DivePanelComponent off screen', () => {
  it('tells the dive when its stage leaves and comes back into view', () => {
    withRecordingObserver<IntersectionObserverCallback>('IntersectionObserver', (observers) => {
      const { fixture, handle } = panelOverRecordingDive();
      const [observer] = observers;
      const stage = fixture.nativeElement.querySelector(`[data-testid="${DIVE_PANEL_TEST_ID.stage}"]`);
      expect(observer!.observed).toEqual([stage]);
      const entry = (isIntersecting: boolean) => [{ isIntersecting } as IntersectionObserverEntry];
      observer!.callback(entry(false), observer as unknown as IntersectionObserver);
      observer!.callback(entry(true), observer as unknown as IntersectionObserver);
      expect(handle.visibility).toEqual([false, true]);
      fixture.destroy();
      expect(observer!.isDisconnected).toBe(true);
    });
  });
});

describe('what the panel measures on its stage (ticket #805)', () => {
  type Observers = readonly RecordedObserver<ResizeObserverCallback>[];
  /** The observer watching `element`, fired as a resize would. */
  const resizeOf = (observers: Observers, element: Element): (() => void) => {
    const observer = observers.find((candidate) => candidate.observed.includes(element));
    expect(observer).toBeDefined();
    return () => observer!.callback([], observer as unknown as ResizeObserver);
  };
  const setBox = (element: Element, box: Record<string, number>): void => {
    for (const [name, value] of Object.entries(box)) Object.defineProperty(element, name, { value });
  };
  const labelTops = (fixture: ComponentFixture<DivePanelComponent>): number[] =>
    [...fixture.nativeElement.querySelectorAll(`[data-testid="${DIVE_PANEL_TEST_ID.label}"]`)].map((label) =>
      parseFloat((label as HTMLElement).style.top),
    );

  it('lays every label’s text out once to measure it, a place named on the planet and the map included', () => {
    const { fixture } = panelOverRecordingDive();
    const texts = [...fixture.nativeElement.querySelectorAll('.label-measures .label')].map(
      (measure) => (measure as HTMLElement).textContent,
    );
    expect(texts).toContain('PACIFIC OCEAN');
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.length).toBe(new Set([...DIVE_GEO_LABELS, ...DIVE_WORLD_LABELS].map((label) => label.text)).size);
  });

  it('reads the readout’s box on its stage, with a clearance past its edge', () => {
    const readout = { offsetLeft: 8, offsetTop: 6, offsetWidth: 420, offsetHeight: 96 } as HTMLElement;
    expect(diveReadoutKeepOut(readout)).toEqual({ right: 432, bottom: 106 });
  });

  it('resizes the dive with its stage when the stage alone changes size, with no window resize', () => {
    withRecordingObserver<ResizeObserverCallback>('ResizeObserver', (observers) => {
      const { fixture, handle } = panelOverRecordingDive();
      const stage = fixture.nativeElement.querySelector(`[data-testid="${DIVE_PANEL_TEST_ID.stage}"]`) as HTMLElement;
      setBox(stage, { clientWidth: 584, clientHeight: 328 });
      resizeOf(observers, stage)();
      expect(handle.stageSizes).toEqual([{ width: 584, height: 328 }]);
      fixture.destroy();
      expect(observers.every((observer) => observer.isDisconnected)).toBe(true);
    });
  });

  it('keeps the labels clear of the readout as measured, re-measured whenever it changes size', () => {
    withRecordingObserver<ResizeObserverCallback>('ResizeObserver', (observers) => {
      const { fixture, handle } = panelOverRecordingDive();
      handle.emitFrame(7.3);
      fixture.detectChanges();
      const readout = fixture.nativeElement.querySelector('.readout') as HTMLElement;
      // A readout as wide as the stage and 500 px tall: every label moves down under it.
      setBox(readout, { offsetLeft: 0, offsetTop: 0, offsetWidth: 1200, offsetHeight: 500 });
      resizeOf(observers, readout)();
      fixture.detectChanges();
      expect(labelTops(fixture).length).toBeGreaterThan(0);
      for (const top of labelTops(fixture)) expect(top).toBeGreaterThanOrEqual(504);
    });
  });

  it('keeps labels apart by their boxes as rendered, not by the estimate', () => {
    withRecordingObserver<ResizeObserverCallback>('ResizeObserver', (observers) => {
      const { fixture, handle } = panelOverRecordingDive();
      handle.emitFrame(7.3);
      fixture.detectChanges();
      const before = labelTops(fixture);
      expect(before.length).toBeGreaterThan(1);
      // Every label measured as wide as the stage: no two can share a line, so each one stacks under the last.
      const measures = [...fixture.nativeElement.querySelectorAll('.label-measures .label')] as HTMLElement[];
      for (const measure of measures) setBox(measure, { offsetWidth: 1200 });
      resizeOf(observers, measures[0]!)();
      fixture.detectChanges();
      const tops = labelTops(fixture).sort((first, second) => first - second);
      for (let index = 1; index < tops.length; index += 1)
        expect(tops[index]! - tops[index - 1]!).toBeGreaterThanOrEqual(20);
    });
  });
});
