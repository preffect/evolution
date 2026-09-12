// Counts a frame's GL draw calls by wrapping the four draw entry points of the context
// (docs/RENDERING.md §6: "counted by wrapping the GL draw functions"). One increment per call; the
// session resets it before each submit and reads it after, so `drawCalls` is the last frame's.

/** The slice of a WebGL context the counter wraps. */
export interface DrawCallSource {
  drawElements(...args: unknown[]): void;
  drawArrays(...args: unknown[]): void;
  drawElementsInstanced(...args: unknown[]): void;
  drawArraysInstanced(...args: unknown[]): void;
}

export interface DrawCallCounter {
  /** Calls since the last `reset`. */
  count(): number;
  reset(): void;
}

const DRAW_METHODS = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const;

export function createDrawCallCounter(context: DrawCallSource): DrawCallCounter {
  let calls = 0;
  for (const method of DRAW_METHODS) {
    const original = context[method];
    context[method] = function countedDraw(this: DrawCallSource, ...args: unknown[]): void {
      calls += 1;
      original.apply(this, args);
    };
  }
  return {
    count: () => calls,
    reset: () => {
      calls = 0;
    },
  };
}
