import { describe, expect, it, vi } from 'vitest';
import { createDrawCallCounter, type DrawCallSource } from './draw-call-counter';

describe('createDrawCallCounter', () => {
  it('counts every wrapped draw call, still forwarding it with its arguments, and resets', () => {
    const context: DrawCallSource = {
      drawElements: vi.fn(),
      drawArrays: vi.fn(),
      drawElementsInstanced: vi.fn(),
      drawArraysInstanced: vi.fn(),
    };
    const forwarded = context.drawElementsInstanced;
    const counter = createDrawCallCounter(context);
    context.drawElementsInstanced(1, 2, 3, 4, 5);
    context.drawArrays(0, 0, 3);
    context.drawElements(0, 6, 0, 0);
    context.drawArraysInstanced(0, 0, 4, 2);
    expect(counter.count()).toBe(4);
    expect(forwarded).toHaveBeenCalledWith(1, 2, 3, 4, 5);
    counter.reset();
    expect(counter.count()).toBe(0);
  });
});
