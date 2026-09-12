import { describe, expect, it, vi } from 'vitest';
import { ManualClock, RENDER_STAGE, RENDER_STAGE_NAMES } from '@evolution/shared';
import type { Application } from 'pixi.js';
import { FrameInstrumentation } from './frame-instrumentation';

/** An app whose renderer exposes a GL context with counted draws and no timer extension. */
function appWithGl() {
  const context = {
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
    drawElementsInstanced: vi.fn(),
    drawArraysInstanced: vi.fn(),
    getExtension: vi.fn(() => null),
  };
  return { app: { renderer: { gl: context } } as unknown as Application, context };
}

describe('FrameInstrumentation', () => {
  it('counts the draw calls of the last submit and builds the report with every stage key', () => {
    const clock = new ManualClock(0);
    const instrumentation = new FrameInstrumentation(clock);
    const { app, context } = appWithGl();
    instrumentation.attach(app);
    instrumentation.timer.beginFrame();
    instrumentation.timer.measure(RENDER_STAGE.submit, () =>
      instrumentation.submit(() => {
        context.drawElements();
        context.drawArraysInstanced();
        clock.advanceMilliseconds(2);
      }),
    );
    instrumentation.timer.endFrame();
    instrumentation.submit(() => context.drawArrays());
    expect(instrumentation.frameCount).toBe(2);
    const report = instrumentation.report({ visibleCells: 3, visibleMotes: 40 }, 2 * 1024 * 1024);
    expect(report.drawCalls).toBe(1);
    expect(report.gpuMs).toBeNull();
    expect(report.heapMb).toBe(2);
    expect(report.visibleCells).toBe(3);
    expect(report.visibleMotes).toBe(40);
    expect(report.renderStagesMs.submit).toBe(2);
    expect(Object.keys(report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
    instrumentation.destroy();
  });

  it('reports zero draw calls and a null GPU time under an app without a GL context', () => {
    const instrumentation = new FrameInstrumentation(new ManualClock(0));
    instrumentation.attach({ renderer: {} } as unknown as Application);
    instrumentation.submit(() => undefined);
    const report = instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null);
    expect(report).toMatchObject({ drawCalls: 0, gpuMs: null, heapMb: null });
  });
});
