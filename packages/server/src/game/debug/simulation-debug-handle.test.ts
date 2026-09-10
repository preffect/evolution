import { describe, expect, it } from 'vitest';
import { hasDebugCapability, type SimulationDebugHandle } from './simulation-debug-handle.js';

describe('hasDebugCapability', () => {
  it('is true only for a capability the handle implements as a function', () => {
    const handle: SimulationDebugHandle = { listEntities: () => [] };
    expect(hasDebugCapability(handle, 'listEntities')).toBe(true);
    expect(hasDebugCapability(handle, 'spawn')).toBe(false);
    expect(hasDebugCapability({}, 'listEntities')).toBe(false);
  });
});
