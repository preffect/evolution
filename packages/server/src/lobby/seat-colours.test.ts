import { describe, expect, it } from 'vitest';
import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN, PLAYER_PALETTE_COUNT } from '@evolution/shared';
import { assignSeatColours, freeAvatarIndex, seatedColours } from './seat-colours.js';

const EVERY_COLOUR = Array.from({ length: PLAYER_PALETTE_COUNT }, (_unused, index) => AVATAR_INDEX_MIN + index);

describe('freeAvatarIndex', () => {
  it('keeps the requested colour when no one holds it', () => {
    expect(freeAvatarIndex(3, [0, 1])).toBe(3);
  });

  it('takes the lowest free colour when the requested one is held', () => {
    expect(freeAvatarIndex(0, [0, 1, 3])).toBe(2);
  });

  it('takes the least-held colour once every colour is held, so repeats spread', () => {
    expect(freeAvatarIndex(0, [...EVERY_COLOUR, 0, 1])).toBe(2);
  });

  it('avoids the requested colour among the least-held ones once every colour is held', () => {
    expect(freeAvatarIndex(AVATAR_INDEX_MIN, EVERY_COLOUR)).toBe(AVATAR_INDEX_MIN + 1);
  });

  it('takes the lowest least-held colour on a tie that does not include the request', () => {
    expect(freeAvatarIndex(AVATAR_INDEX_MAX, EVERY_COLOUR)).toBe(AVATAR_INDEX_MIN);
  });

  it('keeps the request once every colour is held when it alone is least-held', () => {
    expect(freeAvatarIndex(AVATAR_INDEX_MIN, [...EVERY_COLOUR, ...EVERY_COLOUR.slice(1)])).toBe(AVATAR_INDEX_MIN);
  });
});

describe('seatedColours', () => {
  it('reads the colours of the players still in the roster, not those who left', () => {
    const room = { allPlayerIds: ['alice', 'bot'], avatarAssignments: { alice: 0, gone: 1, bot: 2 } };
    expect(seatedColours(room)).toEqual([0, 2]);
  });
});

describe('assignSeatColours', () => {
  it('gives players who all asked for the same colour distinct ones in seat order', () => {
    expect(
      assignSeatColours([
        ['alice', 0],
        ['bob', 0],
        ['carol', 0],
      ]),
    ).toEqual({ alice: 0, bob: 1, carol: 2 });
  });

  it('keeps each free request and moves only the repeats', () => {
    expect(
      assignSeatColours([
        ['alice', 4],
        ['bob', 4],
        ['carol', 0],
      ]),
    ).toEqual({ alice: 4, bob: 0, carol: 1 });
  });
});
