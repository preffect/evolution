import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@evolution/shared';
import type { PlayerCommand } from '../adapter.js';
import { createTestScriptContext } from '../../builders.js';
import { BOT_STRATEGY_NAME, WANDER_STEP_WU } from './strategy-constants.js';
import { createWanderStrategy, type WanderOptions } from './wander.js';

const DECISIONS = 20;

/** The path one fresh strategy instance walks from `seed`, with no cell to anchor on. */
function walk(seed: number, options?: WanderOptions): PlayerCommand[] {
  const strategy = createWanderStrategy(options)();
  const random = createSeededRandom(seed);
  const path: PlayerCommand[] = [];
  for (let decision = 0; decision < DECISIONS; decision += 1) {
    const command = strategy.decide(createTestScriptContext({ tick: decision, stepTick: decision + 1, random }));
    if (command !== null) path.push(command);
  }
  return path;
}

describe('wander strategy', () => {
  it('is named wander and answers a target every decision', () => {
    expect(createWanderStrategy()().name).toBe(BOT_STRATEGY_NAME.wander);
    expect(walk(1)).toHaveLength(DECISIONS);
  });

  it('walks the same path from the same seed and a different one from another seed', () => {
    expect(walk(7)).toEqual(walk(7));
    expect(walk(7)).not.toEqual(walk(8));
  });

  it('moves exactly one step per decision when it has no cell to anchor on', () => {
    const [first, second] = walk(3);
    expect(Math.hypot(first!.targetX!, first!.targetY!)).toBeCloseTo(WANDER_STEP_WU, 6);
    const stepLength = Math.hypot(second!.targetX! - first!.targetX!, second!.targetY! - first!.targetY!);
    expect(stepLength).toBeCloseTo(WANDER_STEP_WU, 6);
  });

  it('starts from the given origin and honours a custom step length', () => {
    const [first] = walk(3, { origin: { x: 100, y: -50 }, stepWu: 5 });
    expect(Math.hypot(first!.targetX! - 100, first!.targetY! + 50)).toBeCloseTo(5, 6);
  });

  it('anchors each step on the cell when the bot has one, so the target stays one step ahead of the cell', () => {
    const strategy = createWanderStrategy({ turnSigmaRadians: 0 })();
    const cell = { x: 500, y: 500, radiusWu: 10 };
    const command = strategy.decide(createTestScriptContext({ cell }));
    expect(command).toEqual({ targetX: 500 + WANDER_STEP_WU, targetY: 500 });
    const again = strategy.decide(createTestScriptContext({ cell: { x: 600, y: 700, radiusWu: 10 } }));
    expect(again).toEqual({ targetX: 600 + WANDER_STEP_WU, targetY: 700 });
  });

  it('builds a fresh walk per instance so two runs from one factory do not share a heading', () => {
    const factory = createWanderStrategy();
    const first = factory();
    const second = factory();
    expect(first).not.toBe(second);
    const context = () => createTestScriptContext({ random: createSeededRandom(5) });
    expect(first.decide(context())).toEqual(second.decide(context()));
  });
});
