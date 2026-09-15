import { describe, expect, it } from 'vitest';
import { keyCapLabel } from './key-cap-label';

describe('keyCapLabel', () => {
  it('shortens the long key names and draws the arrows', () => {
    expect(keyCapLabel('Escape')).toBe('Esc');
    expect(keyCapLabel(' ')).toBe('Space');
    expect(keyCapLabel('ArrowUp')).toBe('↑');
    expect(keyCapLabel('ArrowDown')).toBe('↓');
    expect(keyCapLabel('ArrowLeft')).toBe('←');
    expect(keyCapLabel('ArrowRight')).toBe('→');
  });

  it('shows any other key as it is', () => {
    expect(keyCapLabel('H')).toBe('H');
    expect(keyCapLabel('/')).toBe('/');
    expect(keyCapLabel('Enter')).toBe('Enter');
  });
});
