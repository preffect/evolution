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

const FRAME_MS = 16;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/** An app whose GL context has the timer extension; the n-th query resolves at once to `queryMs[n]`. */
function appWithGpuTimer() {
  const queryMs: number[] = [];
  let created = 0;
  const context = {
    ...appWithGl().context,
    getExtension: vi.fn(() =>
      Object.fromEntries([
        ['TIME_ELAPSED_EXT', 1],
        ['GPU_DISJOINT_EXT', 2],
      ]),
    ),
    getParameter: () => false,
    createQuery: () => ({ index: created++ }),
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    getQueryParameter: (query: { index: number }, name: string) =>
      name === 'available' ? true : (queryMs[query.index] ?? 0) * NANOSECONDS_PER_MILLISECOND,
    deleteQuery: vi.fn(),
    // The GL enum names, built by name as gpu-timer.spec.ts does: the WebGL API's, not ours.
    ...Object.fromEntries([
      ['QUERY_RESULT_AVAILABLE', 'available'],
      ['QUERY_RESULT', 'result'],
    ]),
  };
  return { app: { renderer: { gl: context } } as unknown as Application, queryMs };
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

  it('opens the window on the GPU timer: a warm-up compile stall neither lands in `gpuMs` nor blanks it (#264)', () => {
    const clock = new ManualClock(0);
    const instrumentation = new FrameInstrumentation(clock);
    const { app, queryMs } = appWithGpuTimer();
    instrumentation.attach(app);
    const frameTaking = (gpuMs: number): void => {
      queryMs.push(gpuMs);
      instrumentation.submit(() => clock.advanceMilliseconds(FRAME_MS));
    };
    frameTaking(1);
    frameTaking(FRAME_MS * 50);
    instrumentation.openWindow();
    frameTaking(2);
    frameTaking(3);
    expect(instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null).gpuMs).toBeCloseTo(2.95, 9);
    expect(instrumentation.gpuStatus).toBe(GPU_TIMER_STATUS.ok);
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
    expect(evidence.timerResolutionMs, 'a ManualClock never steps, so its resolution is unknown').toBeNull();
    expect(instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null).renderStagesMs.net).toBe(0);
  });

  it('keeps each frame’s work outside its submit apart, for a budget on the work and not the display (#502)', () => {
    const clock = new ManualClock(0);
    const instrumentation = new FrameInstrumentation(clock);
    const frameWith = (sceneMs: number, submitMs: number): void => {
      instrumentation.runFrame(
        () => {
          clock.advanceMilliseconds(sceneMs);
          return {} as never;
        },
        (_frame, submit) => {
          submit();
          return { visibleCells: 0, visibleMotes: 0 } as never;
        },
        () => clock.advanceMilliseconds(submitMs),
      );
    };
    expect(instrumentation.workOutsideSubmitP95Ms(), 'no frame yet').toBe(0);
    for (let frame = 0; frame < 20; frame += 1) frameWith(0.4, 6);
    expect(instrumentation.workOutsideSubmitP95Ms()).toBeCloseTo(0.4, 9);
    expect(instrumentation.report({ visibleCells: 0, visibleMotes: 0 }, null).frameTimeP95Ms).toBeCloseTo(6.4, 9);
  });
});
