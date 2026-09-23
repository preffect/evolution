// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SPRINT_KEY_CODE, STEER_KEY_CODES } from '../../input/input-constants';
import { KEY_NAMES, keyNameOf } from './key-names';

describe('keyNameOf', () => {
  it('drops the letter prefix, names an arrow, and keeps a code that reads as a name', () => {
    expect(keyNameOf('KeyW')).toBe('W');
    expect(keyNameOf('ArrowUp')).toBe('Up arrow');
    expect(keyNameOf('Space')).toBe('Space');
  });
});

describe('KEY_NAMES', () => {
  it('reads the steer letters and the sprint key from the input layer’s codes', () => {
    expect(KEY_NAMES.steerLetters).toBe('WASD');
    expect(KEY_NAMES.steerLetters).toContain(keyNameOf(STEER_KEY_CODES.up[0] ?? ''));
    expect(KEY_NAMES.sprint).toBe(keyNameOf(SPRINT_KEY_CODE));
  });
});
