import { ManualClock, RENDER_STAGE, RENDER_STAGE_NAMES } from '@evolution/shared';
import type { Application } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { GPU_TIMER_STATUS } from './gpu-timer';
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
    expect(report.drawCalls, 'the worst frame of the window, not the last').toBe(2);
    expect(report.gpuMs).toBeNull();
    expect(report.heapMb).toBe(2);
    expect(report.visibleCells).toBe(3);
    expect(report.visibleMotes).toBe(40);
    expect(report.renderStagesMs.submit).toBe(2);
    expect(Object.keys(report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
    instrumentation.destroy();
  });

  it('reports zero draw calls and an unsupported GPU time under an app without a GL context', () => {
    const instrumentation = new FrameInstrumentation(new ManualClock(0));
    instrumentation.attach({ renderer: {} } as unknown as Application);
    instrumentation.submit(() => undefined);
    const report = instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null);
    expect(report).toMatchObject({ drawCalls: 0, gpuMs: null, heapMb: null });
    expect(instrumentation.gpuStatus).toBe(GPU_TIMER_STATUS.unsupported);
  });

  it('wraps a context once however often it is attached, and unwraps it on destroy', () => {
    const instrumentation = new FrameInstrumentation(new ManualClock(0));
    const { app, context } = appWithGl();
    const original = context.drawElements;
    instrumentation.attach(app);
    instrumentation.attach(app);
    instrumentation.submit(() => context.drawElements());
    expect(instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null).drawCalls).toBe(1);
    instrumentation.destroy();
    expect(context.drawElements).toBe(original);
  });

  it('closes the GPU query and records the count when a submit throws', () => {
    const instrumentation = new FrameInstrumentation(new ManualClock(0));
    const { app, context } = appWithGl();
    instrumentation.attach(app);
    expect(() =>
      instrumentation.submit(() => {
        context.drawElements();
        throw new Error('device lost');
      }),
    ).toThrow('device lost');
    expect(instrumentation.frameCount).toBe(1);
    expect(instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null).drawCalls).toBe(1);
  });

  it('records nothing for a frame the store had nothing for', () => {
    const clock = new ManualClock(0);
    const instrumentation = new FrameInstrumentation(clock);
    const render = vi.fn();
    const empty = instrumentation.runFrame(
      () => {
        clock.advanceMilliseconds(3);
        return null;
      },
      () => {
        render();
        return { visibleCells: 0, visibleMotes: 0 } as never;
      },
      () => undefined,
    );
    expect(empty).toBeNull();
    expect(render).not.toHaveBeenCalled();
    const evidence = instrumentation.evidence();
    expect(evidence.sampleCount).toBe(0);
    expect(instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null).renderStagesMs.net).toBe(0);
  });
});
