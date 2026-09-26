import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import {
  TEST_PLAYER_ID,
  createTestBotCell,
  createTestPerception,
  createTestScriptContext,
  createTestWorldView,
} from '../../../testing/bot-builders.js';
import {
  BOT_STRATEGY_NAME,
  FLEE_STEP_RADII,
  FORAGER_FLEE_WITHIN_RADII,
  FORAGER_SPRINT_WITHIN_RADII,
} from '../strategy-constants.js';
import { createForagerStrategy } from './forager.js';

const perception = createTestPerception();
const self = createTestBotCell({ id: 'self', playerId: TEST_PLAYER_ID, x: 100, y: 100, mass: 20, radius: 10 });
const mote = { id: 'mote', x: 100, y: 130 };
/** A cell that can engulf `self`, `radii` of its own radii east of it. */
function threatAt(radii: number) {
  return createTestBotCell({
    id: 'threat',
    playerId: playerId('player_1'),
    x: self.x + self.radius * radii,
    y: self.y,
    mass: 100,
  });
}
/** A heavier-looking neighbour that cannot engulf `self` (the same mass), right beside it. */
const harmless = createTestBotCell({ id: 'harmless', playerId: playerId('player_2'), x: 110, y: 100, mass: 20 });
/** Where the forager aims fleeing a threat due east: `FLEE_STEP_RADII` own radii due west. */
const westward = { targetX: self.x - FLEE_STEP_RADII * self.radius, targetY: self.y };
const towardMote = { targetX: mote.x, targetY: mote.y };

function contextWith(cells: readonly ReturnType<typeof createTestBotCell>[]) {
  return createTestScriptContext({ snapshot: createTestWorldView({ cells, motes: [mote] }), cell: self });
}

describe('forager strategy', () => {
  it('is named forager', () => {
    expect(createForagerStrategy(perception)().name).toBe(BOT_STRATEGY_NAME.forager);
  });

  it('grazes the nearest mote with no threat about, a harmless neighbour included', () => {
    expect(createForagerStrategy(perception)().decide(contextWith([self]))).toEqual(towardMote);
    expect(createForagerStrategy(perception)().decide(contextWith([self, harmless]))).toEqual(towardMote);
  });

  it('flees a threat in range instead of grazing, without sprinting outside the sprint range', () => {
    const edge = threatAt(FORAGER_FLEE_WITHIN_RADII);
    expect(createForagerStrategy(perception)().decide(contextWith([self, edge]))).toEqual(westward);
  });

  it('keeps grazing when the same threat is just out of range', () => {
    const outside = threatAt(FORAGER_FLEE_WITHIN_RADII + 1);
    expect(createForagerStrategy(perception)().decide(contextWith([self, outside]))).toEqual(towardMote);
  });

  it('sprints away once the threat is within the sprint range, and not one radius outside it', () => {
    const close = threatAt(FORAGER_SPRINT_WITHIN_RADII);
    expect(createForagerStrategy(perception)().decide(contextWith([self, close]))).toEqual({
      ...westward,
      isSprinting: true,
    });
    const justOutside = threatAt(FORAGER_SPRINT_WITHIN_RADII + 1);
    expect(createForagerStrategy(perception)().decide(contextWith([self, justOutside]))).toEqual(westward);
  });
});
