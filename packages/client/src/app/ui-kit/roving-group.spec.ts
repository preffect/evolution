import { describe, expect, it } from 'vitest';
import { ROVING_MOVE, UI_ORIENTATION, isRovingSelectKey, rovingMoveFor, rovingTargetIndex } from './roving-group';

describe('isRovingSelectKey', () => {
  it('is Enter and Space, and nothing that moves the focus instead', () => {
    expect(isRovingSelectKey('Enter')).toBe(true);
    expect(isRovingSelectKey(' ')).toBe(true);
    for (const key of ['ArrowDown', 'Home', 'Escape', 'Spacebar', 'a']) {
      expect(isRovingSelectKey(key)).toBe(false);
    }
  });
});

describe('rovingMoveFor', () => {
  it('moves along ↑ ↓ in a vertical group and leaves ← → alone', () => {
    expect(rovingMoveFor('ArrowUp', UI_ORIENTATION.vertical)).toBe(ROVING_MOVE.previous);
    expect(rovingMoveFor('ArrowDown', UI_ORIENTATION.vertical)).toBe(ROVING_MOVE.next);
    expect(rovingMoveFor('ArrowLeft', UI_ORIENTATION.vertical)).toBeNull();
    expect(rovingMoveFor('ArrowRight', UI_ORIENTATION.vertical)).toBeNull();
  });

  it('moves along ← → in a horizontal group and leaves ↑ ↓ alone', () => {
    expect(rovingMoveFor('ArrowLeft', UI_ORIENTATION.horizontal)).toBe(ROVING_MOVE.previous);
    expect(rovingMoveFor('ArrowRight', UI_ORIENTATION.horizontal)).toBe(ROVING_MOVE.next);
    expect(rovingMoveFor('ArrowUp', UI_ORIENTATION.horizontal)).toBeNull();
    expect(rovingMoveFor('ArrowDown', UI_ORIENTATION.horizontal)).toBeNull();
  });

  it('jumps with Home and End either way, and ignores every other key', () => {
    for (const orientation of Object.values(UI_ORIENTATION)) {
      expect(rovingMoveFor('Home', orientation)).toBe(ROVING_MOVE.first);
      expect(rovingMoveFor('End', orientation)).toBe(ROVING_MOVE.last);
      expect(rovingMoveFor('Enter', orientation)).toBeNull();
      expect(rovingMoveFor('Escape', orientation)).toBeNull();
    }
  });
});

describe('rovingTargetIndex', () => {
  const allEnabled = [true, true, true, true];

  it('steps one item either way and stops at the ends without wrapping', () => {
    expect(rovingTargetIndex(ROVING_MOVE.next, 1, allEnabled)).toBe(2);
    expect(rovingTargetIndex(ROVING_MOVE.previous, 1, allEnabled)).toBe(0);
    expect(rovingTargetIndex(ROVING_MOVE.next, 3, allEnabled)).toBeNull();
    expect(rovingTargetIndex(ROVING_MOVE.previous, 0, allEnabled)).toBeNull();
  });

  it('jumps to the first and last enabled item', () => {
    expect(rovingTargetIndex(ROVING_MOVE.first, 2, [false, true, true, false])).toBe(1);
    expect(rovingTargetIndex(ROVING_MOVE.last, 1, [false, true, true, false])).toBe(2);
  });

  it('steps over disabled items, and answers null when only disabled ones lie that way', () => {
    expect(rovingTargetIndex(ROVING_MOVE.next, 0, [true, false, false, true])).toBe(3);
    expect(rovingTargetIndex(ROVING_MOVE.previous, 3, [true, false, false, true])).toBe(0);
    expect(rovingTargetIndex(ROVING_MOVE.next, 1, [true, true, false, false])).toBeNull();
    expect(rovingTargetIndex(ROVING_MOVE.first, 0, [false, false])).toBeNull();
  });
});
