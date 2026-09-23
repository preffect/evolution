// docs/architecture/entity-model.md §2: the literal every cell is born from, for a player and for a wild cell.
import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  DEFAULT_CELL_MODIFIERS,
  NO_STEER_COMMAND,
  STARTING_STAGE,
  entityId,
  playerId,
} from '@evolution/shared';
import { bornCellRecord } from './cell-record.js';
import { isPlayerCell } from './entities.js';

describe('bornCellRecord', () => {
  it('is free, at rest and underived, carrying the identity it was given', () => {
    const cell = bornCellRecord(
      {
        id: entityId('c-9'),
        kind: CELL_KIND.player,
        playerId: playerId('p1'),
        organismId: entityId('c-9'),
        avatarIndex: 3,
        level: 4,
      },
      { x: 10, y: -20 },
      50,
    );
    expect(cell).toMatchObject({
      id: 'c-9',
      kind: 'player',
      playerId: 'p1',
      organismId: 'c-9',
      avatarIndex: 3,
      level: 4,
    });
    expect(cell).toMatchObject({ x: 10, y: -20, velocityX: 0, velocityY: 0, mass: 50, radius: 0 });
    expect(cell).toMatchObject({ stage: STARTING_STAGE, traits: [], states: [], engulfProgress: 0 });
    expect(cell).toMatchObject({
      targetX: null,
      targetY: null,
      pinnedX: null,
      carriedOffsetX: null,
      lastRelease: null,
    });
    expect(cell.modifiers).toEqual(DEFAULT_CELL_MODIFIERS);
    expect(cell.modifiers).not.toBe(DEFAULT_CELL_MODIFIERS);
    expect(cell.steerCommand).toBe(NO_STEER_COMMAND);
    expect(isPlayerCell(cell)).toBe(true);
  });

  it('makes a wild cell with no player, its own organism', () => {
    const cell = bornCellRecord(
      {
        id: entityId('c-2'),
        kind: CELL_KIND.wild,
        playerId: null,
        organismId: entityId('c-2'),
        avatarIndex: 0,
        level: 1,
      },
      { x: 0, y: 0 },
      20,
    );
    expect(cell.kind).toBe(CELL_KIND.wild);
    expect(cell.playerId).toBeNull();
    expect(cell.organismId).toBe(cell.id);
    expect(isPlayerCell(cell)).toBe(false);
  });
});
