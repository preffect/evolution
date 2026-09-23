import { afterAll, vi } from 'vitest';

// Plain specs share a worker and its module state with the files before them (vitest-base.config.ts,
// ticket #540). A fake clock or a stubbed global one file forgets to restore must not reach the next.
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
