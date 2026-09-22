import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import {
  TEST_PLAYER_ID,
  createTestBotCell,
  createTestPerception,
  createTestScriptContext,
  createTestWorldView,
} from '../../../testing/bot-builders.js';
import { BOT_STRATEGY_NAME, FLEE_STEP_RADII, FLEE_WITHIN_RADII } from '../strategy-constants.js';
import { createFleeStrategy, fleeTargetFrom } from './flee.js';

const perception = createTestPerception();
const self = createTestBotCell({ id: 'self', playerId: TEST_PLAYER_ID, x: 100, y: 100, mass: 20, radius: 10 });
/** A threat 5 own radii east: inside the default range. */
const nearThreat = createTestBotCell({ id: 'near', playerId: playerId('player_1'), x: 150, y: 100, mass: 100 });
/** The same threat one radius past the default range. */
const farThreat = { ...nearThreat, id: 'far', x: self.x + self.radius * (FLEE_WITHIN_RADII + 1) };
/** Closer than `nearThreat` but too light to engulf `self`: not a threat. */
const harmless = createTestBotCell({ id: 'harmless', playerId: playerId('player_2'), x: 100, y: 120, mass: 20 });
const northThreat = createTestBotCell({ id: 'north', playerId: playerId('player_3'), x: 100, y: 30, mass: 100 });

function contextWith(cells: readonly ReturnType<typeof createTestBotCell>[]) {
  return createTestScriptContext({ snapshot: createTestWorldView({ cells }), cell: self });
}

describe('flee strategy', () => {
  it('is named flee', () => {
    expect(createFleeStrategy(perception)().name).toBe(BOT_STRATEGY_NAME.flee);
  });

  it('flees a threat within range: FLEE_STEP_RADII own radii from its centre, straight away from it', () => {
    const command = createFleeStrategy(perception)().decide(contextWith([self, nearThreat]));
    expect(command).toEqual({ targetX: self.x - FLEE_STEP_RADII * self.radius, targetY: self.y });
  });

  it('does not flee the same threat once it is out of range, nor a cell that cannot engulf it', () => {
    const strategy = createFleeStrategy(perception)();
    expect(strategy.decide(contextWith([self, farThreat]))).toBeNull();
    expect(strategy.decide(contextWith([self, harmless]))).toBeNull();
    expect(strategy.decide(contextWith([self]))).toBeNull();
  });

  it('flees the nearest threat when several are in range, ignoring a nearer harmless cell', () => {
    const command = createFleeStrategy(perception)().decide(contextWith([self, harmless, nearThreat, northThreat]));
    expect(command).toEqual({ targetX: self.x - FLEE_STEP_RADII * self.radius, targetY: self.y });
  });

  it('honours a custom range and step: the far threat counts at 9 radii, the step is 3 radii', () => {
    const strategy = createFleeStrategy(perception, { withinRadii: FLEE_WITHIN_RADII + 1, stepRadii: 3 })();
    expect(strategy.decide(contextWith([self, farThreat]))).toEqual({
      targetX: self.x - 3 * self.radius,
      targetY: self.y,
    });
  });

  it('sends nothing when its own cell is not in the snapshot', () => {
    expect(createFleeStrategy(perception)().decide(contextWith([nearThreat]))).toBeNull();
  });

  it('aims at its own centre when the threat sits exactly on it (no direction to run)', () => {
    expect(fleeTargetFrom(self, { x: self.x, y: self.y }, FLEE_STEP_RADII)).toEqual({ x: self.x, y: self.y });
  });
});
