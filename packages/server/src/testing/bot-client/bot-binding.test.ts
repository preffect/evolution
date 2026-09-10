import { describe, expect, it } from 'vitest';
import { createTestBotCell, createTestBotIdentity } from '../bot-builders.js';
import { toEchoInput } from '../gameplay/echo-adapter.js';
import { echoBotBinding } from './bot-binding.js';

describe('echo bot binding', () => {
  it('locates no cell in any snapshot, because the echo has no world', () => {
    expect(echoBotBinding.locateCell({ players: {} }, createTestBotIdentity().playerId)).toBeUndefined();
  });

  it("maps a command with the echo adapter's own input mapping, sequence included", () => {
    const command = { targetX: 3, targetY: 4, isSprinting: true };
    expect(echoBotBinding.toInput(command, 7)).toEqual(toEchoInput(command, 7));
  });

  it('sees nothing and lets nothing be engulfed', () => {
    expect(echoBotBinding.perception.cellsOf({})).toEqual([]);
    expect(echoBotBinding.perception.motesOf({})).toEqual([]);
    expect(echoBotBinding.perception.canEngulf(createTestBotCell({ mass: 1000 }), createTestBotCell({ mass: 1 }))).toBe(
      false,
    );
  });
});
