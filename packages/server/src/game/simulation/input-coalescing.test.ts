// docs/ARCHITECTURE.md §3.2: coalescing between ticks.
import { describe, expect, it } from 'vitest';
import { createTestGameInput } from '@evolution/shared';
import { coalesceInput, isStaleInput } from './input-coalescing.js';

describe('coalesceInput', () => {
  it('returns the incoming input when nothing is pending', () => {
    const incoming = createTestGameInput({ sequence: 3 });
    expect(coalesceInput(null, incoming)).toBe(incoming);
  });

  it('lets the newest sequence and target win', () => {
    const pending = createTestGameInput({ sequence: 1, targetX: 10, targetY: 20 });
    const incoming = createTestGameInput({ sequence: 2, targetX: 30, targetY: 40 });
    expect(coalesceInput(pending, incoming)).toMatchObject({ sequence: 2, targetX: 30, targetY: 40 });
  });

  it('OR-merges the sprint flag', () => {
    const pending = createTestGameInput({ sequence: 1, shouldSprint: true });
    expect(coalesceInput(pending, createTestGameInput({ sequence: 2 })).shouldSprint).toBe(true);
    expect(coalesceInput(createTestGameInput({ sequence: 1 }), createTestGameInput({ sequence: 2 })).shouldSprint).toBe(
      false,
    );
  });

  it('keeps an earlier trait pick when the newer input carries none, and replaces it with a newer pick', () => {
    const pick = { offerId: 1, cardIndex: 2 };
    const pending = createTestGameInput({ sequence: 1, traitChoice: pick });
    expect(coalesceInput(pending, createTestGameInput({ sequence: 2 })).traitChoice).toEqual(pick);
    const newer = { offerId: 2, cardIndex: 0 };
    expect(coalesceInput(pending, createTestGameInput({ sequence: 2, traitChoice: newer })).traitChoice).toEqual(newer);
  });
});

describe('isStaleInput', () => {
  it('rejects a sequence not newer than the applied one or the pending one', () => {
    expect(isStaleInput(createTestGameInput({ sequence: 5 }), 5, null)).toBe(true);
    expect(isStaleInput(createTestGameInput({ sequence: 4 }), 5, null)).toBe(true);
    expect(isStaleInput(createTestGameInput({ sequence: 6 }), 5, null)).toBe(false);
    expect(isStaleInput(createTestGameInput({ sequence: 6 }), 5, createTestGameInput({ sequence: 6 }))).toBe(true);
    expect(isStaleInput(createTestGameInput({ sequence: 7 }), 5, createTestGameInput({ sequence: 6 }))).toBe(false);
  });
});
