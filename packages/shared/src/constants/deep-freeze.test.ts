import { describe, expect, it } from 'vitest';
import { deepFreeze } from './deep-freeze.js';

function graph() {
  const shared = { value: 1 };
  return { top: 1, nested: { list: [shared, { value: 2 }], shared }, alias: shared };
}

describe('deepFreeze', () => {
  it('freezes the root and every reachable object and array, and returns the same object', () => {
    const value = graph();
    const frozen = deepFreeze(value);
    expect(frozen).toBe(value);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.nested)).toBe(true);
    expect(Object.isFrozen(value.nested.list)).toBe(true);
    expect(Object.isFrozen(value.nested.list[1])).toBe(true);
    expect(Object.isFrozen(value.alias)).toBe(true);
  });

  it('makes a write to any leaf throw in strict mode', () => {
    const value = deepFreeze(graph());
    const mutable = value as { top: number; nested: { list: { value: number }[] } };
    expect(() => {
      mutable.top = 2;
    }).toThrow(TypeError);
    expect(() => {
      mutable.nested.list[0]!.value = 3;
    }).toThrow(TypeError);
  });

  it('leaves primitives and null alone and terminates on an already frozen member', () => {
    expect(deepFreeze(3)).toBe(3);
    expect(deepFreeze(null)).toBeNull();
    const inner = Object.freeze({ value: 1 });
    expect(deepFreeze({ inner })).toEqual({ inner });
  });

  it('still clones into a writable copy', () => {
    const copy: ReturnType<typeof graph> = structuredClone(deepFreeze(graph()));
    copy.top = 2;
    expect(copy.top).toBe(2);
    expect(Object.isFrozen(copy)).toBe(false);
  });
});
