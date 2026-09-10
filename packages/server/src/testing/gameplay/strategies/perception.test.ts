import { describe, expect, it } from 'vitest';
import { createTestBotCell } from '../../builders.js';
import { NO_WORLD_PERCEPTION, distanceBetween, nearestTo } from './perception.js';

describe('perception helpers', () => {
  it('measures euclidean distance', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('finds the nearest item, keeps the earlier one on a tie and yields undefined for nothing', () => {
    const items = [
      { id: 'a', x: 5, y: 0 },
      { id: 'b', x: 0, y: 5 },
      { id: 'c', x: 1, y: 1 },
    ];
    expect(nearestTo({ x: 0, y: 0 }, items)?.id).toBe('c');
    expect(nearestTo({ x: 5, y: 5 }, items.slice(0, 2))?.id).toBe('a');
    expect(nearestTo({ x: 0, y: 0 }, [])).toBeUndefined();
  });

  it('the no-world perception sees nothing and lets nothing be engulfed', () => {
    expect(NO_WORLD_PERCEPTION.cellsOf({})).toEqual([]);
    expect(NO_WORLD_PERCEPTION.motesOf({})).toEqual([]);
    expect(NO_WORLD_PERCEPTION.canEngulf(createTestBotCell({ mass: 1000 }), createTestBotCell({ mass: 1 }))).toBe(false);
  });
});
