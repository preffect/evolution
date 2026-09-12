// Counts a frame's GL draw calls by wrapping the four draw entry points of the context
// (docs/RENDERING.md §6: "counted by wrapping the GL draw functions"). One increment per call; the
// session resets it before each submit and reads it after, so every frame contributes one count and
// the report carries the window's worst frame. `restore` puts the context's own methods back, so a
// counter is never wrapped over another.

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
  /** Unwraps the context's draw entry points. */
  restore(): void;
}

const DRAW_METHODS = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const;

export function createDrawCallCounter(context: DrawCallSource): DrawCallCounter {
  let calls = 0;
  const originals = new Map<(typeof DRAW_METHODS)[number], DrawCallSource[(typeof DRAW_METHODS)[number]]>();
  for (const method of DRAW_METHODS) {
    const original = context[method];
    originals.set(method, original);
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
    restore: () => {
      for (const [method, original] of originals) context[method] = original;
      originals.clear();
    },
  };
}
