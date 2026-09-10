import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import {
  TEST_PLAYER_ID,
  createTestBotCell,
  createTestPerception,
  createTestScriptContext,
  createTestWorldView,
} from '../../../testing/bot-builders.js';
import { createHunterStrategy } from './hunter.js';
import { BOT_STRATEGY_NAME, HUNTER_SPRINT_WITHIN_RADII } from '../strategy-constants.js';

const perception = createTestPerception();
const self = createTestBotCell({ id: 'self', playerId: TEST_PLAYER_ID, mass: 100, radius: 10 });
const smallPrey = createTestBotCell({ id: 'small', playerId: playerId('player_1'), x: 300, y: 0, mass: 40 });
const biggerPrey = createTestBotCell({ id: 'bigger', playerId: playerId('player_2'), x: 0, y: 300, mass: 70 });
const tooBig = createTestBotCell({ id: 'big', playerId: playerId('player_3'), x: 20, y: 0, mass: 90 });

function contextWith(cells: readonly ReturnType<typeof createTestBotCell>[]) {
  return createTestScriptContext({
    snapshot: createTestWorldView({ cells }),
    cell: { x: self.x, y: self.y, radius: self.radius },
  });
}

describe('hunter strategy', () => {
  it('is named hunter', () => {
    expect(createHunterStrategy(perception)().name).toBe(BOT_STRATEGY_NAME.hunter);
  });

  it('chases the largest cell it can engulf and ignores the ones it cannot', () => {
    const command = createHunterStrategy(perception)().decide(contextWith([self, smallPrey, biggerPrey, tooBig]));
    expect(command).toEqual({ targetX: biggerPrey.x, targetY: biggerPrey.y });
  });

  it('never hunts its own cell and sends nothing when nothing is engulfable', () => {
    const strategy = createHunterStrategy(perception)();
    expect(strategy.decide(contextWith([self, tooBig]))).toBeNull();
    expect(strategy.decide(contextWith([self]))).toBeNull();
  });

  it('sends nothing when its own cell is not in the snapshot', () => {
    expect(createHunterStrategy(perception)().decide(contextWith([smallPrey]))).toBeNull();
  });

  it('respects the Cell Wall bonus the perception folds into the predicate', () => {
    const walled = createTestBotCell({
      id: 'walled',
      playerId: playerId('player_4'),
      x: 50,
      y: 50,
      mass: 70,
      membraneRatioBonus: 0.5,
    });
    expect(createHunterStrategy(perception)().decide(contextWith([self, walled]))).toBeNull();
  });

  it('commits to its prey while it stays engulfable, even when a larger one appears', () => {
    const strategy = createHunterStrategy(perception)();
    strategy.decide(contextWith([self, smallPrey]));
    const command = strategy.decide(contextWith([self, smallPrey, biggerPrey]));
    expect(command).toEqual({ targetX: smallPrey.x, targetY: smallPrey.y });
  });

  it('picks again when the committed prey is gone or has outgrown it', () => {
    const strategy = createHunterStrategy(perception)();
    strategy.decide(contextWith([self, smallPrey]));
    expect(strategy.decide(contextWith([self, biggerPrey]))).toEqual({ targetX: biggerPrey.x, targetY: biggerPrey.y });
    const grown = { ...biggerPrey, mass: 95 };
    expect(strategy.decide(contextWith([self, grown, smallPrey]))).toEqual({
      targetX: smallPrey.x,
      targetY: smallPrey.y,
    });
  });

  it('sprints once the prey is within the sprint range of its own radius', () => {
    const close = { ...smallPrey, x: self.radius * HUNTER_SPRINT_WITHIN_RADII, y: 0 };
    const command = createHunterStrategy(perception)().decide(contextWith([self, close]));
    expect(command).toEqual({ targetX: close.x, targetY: 0, isSprinting: true });
  });

  it('hunts only the named player when one is given', () => {
    const strategy = createHunterStrategy(perception, { preyPlayerId: smallPrey.playerId })();
    expect(strategy.decide(contextWith([self, smallPrey, biggerPrey]))).toEqual({ targetX: smallPrey.x, targetY: 0 });
    expect(strategy.decide(contextWith([self, biggerPrey]))).toBeNull();
  });
});
