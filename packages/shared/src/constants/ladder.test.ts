import { describe, expect, it } from 'vitest';
import { CELL_STAGE } from '../types/game.js';
import { STAGE_ORDER, STARTING_STAGE } from './ladder.js';

describe('the ladder order', () => {
  it('lists every stage of CELL_STAGE exactly once', () => {
    expect([...STAGE_ORDER].sort()).toEqual(Object.values(CELL_STAGE).sort());
    expect(new Set(STAGE_ORDER).size).toBe(STAGE_ORDER.length);
  });

  it('starts every round and respawn as a protocell', () => {
    expect(STARTING_STAGE).toBe(CELL_STAGE.protocell);
    expect(STAGE_ORDER[0]).toBe(STARTING_STAGE);
  });
});
