import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualClock } from '@evolution/shared';
import { CLOCK } from '../../clock-provider';
import { EVOLUTION_DEBUG_KEY, EVOLUTION_DEBUG_MODE } from '../../debug/evolution-debug';
import { RENDER_BENCH_REPORT_TEST_ID, RENDER_BENCH_TEST_ID, RenderBenchComponent } from './render-bench.component';

describe('RenderBenchComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RenderBenchComponent],
      providers: [{ provide: CLOCK, useValue: new ManualClock(0) }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window[EVOLUTION_DEBUG_KEY];
  });

  it('mounts the host and the empty report, installs the bench debug hook and uninstalls it on destroy', async () => {
    // jsdom has no WebGL: Pixi logs its own failure, then the component logs the rejection.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(RenderBenchComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector(`[data-testid="${RENDER_BENCH_TEST_ID}"]`)).not.toBeNull();
    expect(element.querySelector(`[data-testid="${RENDER_BENCH_REPORT_TEST_ID}"]`)?.textContent).toBe('');
    expect(window[EVOLUTION_DEBUG_KEY]?.mode).toBe(EVOLUTION_DEBUG_MODE.bench);
    expect(window[EVOLUTION_DEBUG_KEY]?.renderTick()).toBeNull();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(consoleError).toHaveBeenLastCalledWith('The bench could not start.', expect.anything());
    fixture.destroy();
    expect(window[EVOLUTION_DEBUG_KEY]).toBeUndefined();
  });
});
