import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import type { CellLocation } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import {
  chooseTrait,
  combineScripts,
  command,
  idle,
  mergeCommands,
  sprint,
  targetPoint,
  targetRadiiAwayFrom,
  targetRadiiEast,
  type ScriptContext,
} from './scripts.js';

const CELL: CellLocation = { x: 100, y: 50, radiusWu: 10 };

function contextWith(cell: CellLocation | undefined): ScriptContext<null> {
  return { tick: 4, stepTick: 5, playerIndex: 0, playerId: playerId('player_0'), snapshot: null, cell };
}

describe('mergeCommands', () => {
  it('lets later fields win', () => {
    expect(mergeCommands({ targetX: 1, targetY: 2 }, { targetX: 3 })).toEqual({ targetX: 3, targetY: 2 });
  });

  it('keeps a sprint one-shot from either side', () => {
    expect(mergeCommands({ isSprinting: true }, { targetX: 1, isSprinting: false })).toEqual({
      targetX: 1,
      isSprinting: true,
    });
    expect(mergeCommands({ targetX: 1 }, { isSprinting: true })).toEqual({ targetX: 1, isSprinting: true });
  });
});

describe('scripts', () => {
  it('targetRadiiEast targets N radii east of the current centre', () => {
    expect(targetRadiiEast(5)(contextWith(CELL))).toEqual({ targetX: 150, targetY: 50 });
  });

  it('targetRadiiEast fails the scenario when the player has no cell', () => {
    expect(() => targetRadiiEast(5)(contextWith(undefined))).toThrow(ScenarioSetupError);
    expect(() => targetRadiiEast(5)(contextWith(undefined))).toThrow(/player 0 has no cell at tick 4/);
  });

  it('targetRadiiAwayFrom targets N radii along the line away from a point', () => {
    const script = targetRadiiAwayFrom(2, { x: 100, y: 20 });
    expect(script(contextWith(CELL))).toEqual({ targetX: 100, targetY: 70 });
  });

  it('targetRadiiAwayFrom falls back to east when the point is the centre itself', () => {
    expect(targetRadiiAwayFrom(2, { x: CELL.x, y: CELL.y })(contextWith(CELL))).toEqual({ targetX: 120, targetY: 50 });
  });

  it('targetPoint, sprint, chooseTrait and command are literal', () => {
    expect(targetPoint(1, 2)(contextWith(undefined))).toEqual({ targetX: 1, targetY: 2 });
    expect(sprint()(contextWith(undefined))).toEqual({ isSprinting: true });
    expect(chooseTrait({ offerId: 1, cardIndex: 2 })(contextWith(undefined))).toEqual({
      traitChoice: { offerId: 1, cardIndex: 2 },
    });
    expect(command({ targetX: 9 })(contextWith(undefined))).toEqual({ targetX: 9 });
  });

  it('idle sends nothing', () => {
    expect(idle(contextWith(CELL))).toBeNull();
  });

  it('combineScripts merges in order and skips silent scripts', () => {
    const combined = combineScripts([sprint(), idle, targetRadiiEast(1)]);
    expect(combined(contextWith(CELL))).toEqual({ isSprinting: true, targetX: 110, targetY: 50 });
    expect(combineScripts([idle, idle])(contextWith(CELL))).toBeNull();
  });
});
