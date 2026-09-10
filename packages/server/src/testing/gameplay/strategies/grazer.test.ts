import { describe, expect, it } from 'vitest';
import { createTestPerception, createTestScriptContext, createTestWorldView } from '../../bot-builders.js';
import { createGrazerStrategy } from './grazer.js';
import { BOT_STRATEGY_NAME } from './strategy-constants.js';

const CELL = { x: 0, y: 0, radiusWu: 10 };
const perception = createTestPerception();

describe('grazer strategy', () => {
  it('is named grazer', () => {
    expect(createGrazerStrategy(perception)().name).toBe(BOT_STRATEGY_NAME.grazer);
  });

  it('targets the nearest mote', () => {
    const snapshot = createTestWorldView({
      motes: [
        { id: 'far', x: 100, y: 0 },
        { id: 'near', x: 3, y: 4 },
        { id: 'mid', x: -20, y: 0 },
      ],
    });
    const command = createGrazerStrategy(perception)().decide(createTestScriptContext({ snapshot, cell: CELL }));
    expect(command).toEqual({ targetX: 3, targetY: 4 });
  });

  it('sends nothing without a cell', () => {
    const snapshot = createTestWorldView({ motes: [{ id: 'm', x: 1, y: 1 }] });
    expect(createGrazerStrategy(perception)().decide(createTestScriptContext({ snapshot }))).toBeNull();
  });

  it('sends nothing when it sees no motes', () => {
    const snapshot = createTestWorldView();
    expect(createGrazerStrategy(perception)().decide(createTestScriptContext({ snapshot, cell: CELL }))).toBeNull();
  });

  it('re-evaluates every decision from the current snapshot (no memory of a mote that was eaten)', () => {
    const strategy = createGrazerStrategy(perception)();
    strategy.decide(
      createTestScriptContext({ snapshot: createTestWorldView({ motes: [{ id: 'a', x: 1, y: 0 }] }), cell: CELL }),
    );
    const next = strategy.decide(
      createTestScriptContext({ snapshot: createTestWorldView({ motes: [{ id: 'b', x: 0, y: 9 }] }), cell: CELL }),
    );
    expect(next).toEqual({ targetX: 0, targetY: 9 });
  });
});
