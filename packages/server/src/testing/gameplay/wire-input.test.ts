import { describe, expect, it } from 'vitest';
import { toWireInput } from './wire-input.js';

describe('toWireInput', () => {
  it('maps a full command onto the wire input, stamped with the sequence', () => {
    const choice = { offerId: 2, cardIndex: 1 };
    expect(toWireInput({ targetX: 30, targetY: -4, isSprinting: true, traitChoice: choice }, 9)).toEqual({
      sequence: 9,
      targetX: 30,
      targetY: -4,
      shouldSprint: true,
      traitChoice: choice,
    });
  });

  it('aims a command without a target at the origin and clears the one-shots', () => {
    expect(toWireInput({}, 1)).toEqual({ sequence: 1, targetX: 0, targetY: 0, shouldSprint: false, traitChoice: null });
  });
});
