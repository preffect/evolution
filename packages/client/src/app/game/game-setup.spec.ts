import { EMPTY } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { setupGame } from './game-setup';

describe('setupGame (template placeholder)', () => {
  it('returns a teardown that can be called safely', () => {
    const send = vi.fn();
    const teardown = setupGame({ send, messages$: EMPTY, drainLatestSnapshot: () => null });
    expect(() => teardown()).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
