import { describe, expect, it } from 'vitest';
import { createTestBotCell, createTestBotIdentity, createTestPerception } from '../../testing/bot-builders.js';
import { echoBotBinding, locateCellThrough, toWireInput } from './bot-binding.js';

describe('locateCellThrough', () => {
  it("narrows the perception's own cell to a location and passes an absent cell through", () => {
    const self = createTestBotCell({ x: 5, y: 6, radius: 7 });
    const locate = locateCellThrough(createTestPerception());
    expect(locate({ cells: [self], motes: [] }, self.playerId)).toEqual({ x: 5, y: 6, radius: 7 });
    expect(locate({ cells: [], motes: [] }, self.playerId)).toBeUndefined();
  });
});

describe('toWireInput', () => {
  it('maps a command to the wire input, aiming at the origin and holding no choice when unsaid', () => {
    expect(toWireInput({}, 3)).toEqual({ sequence: 3, targetX: 0, targetY: 0, shouldSprint: false, traitChoice: null });
    const choice = { offerId: 1, cardIndex: 2 };
    expect(toWireInput({ targetX: 3, targetY: 4, isSprinting: true, traitChoice: choice }, 7)).toEqual({
      sequence: 7,
      targetX: 3,
      targetY: 4,
      shouldSprint: true,
      traitChoice: choice,
    });
  });
});

describe('echo bot binding', () => {
  it('locates no cell in any snapshot, because the echo has no world', () => {
    expect(echoBotBinding.locateCell({ players: {} }, createTestBotIdentity().playerId)).toBeUndefined();
  });

  it('maps a command with the echo input mapping, sequence included', () => {
    const command = { targetX: 3, targetY: 4, isSprinting: true };
    expect(echoBotBinding.toInput(command, 7)).toEqual(toWireInput(command, 7));
  });

  it('sees nothing and lets nothing be engulfed', () => {
    expect(echoBotBinding.perception.cellsOf({})).toEqual([]);
    expect(echoBotBinding.perception.motesOf({})).toEqual([]);
    expect(echoBotBinding.perception.canEngulf(createTestBotCell({ mass: 1000 }), createTestBotCell({ mass: 1 }))).toBe(
      false,
    );
  });
});
