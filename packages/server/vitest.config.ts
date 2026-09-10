import { defineConfig } from 'vitest/config';
import { coverageOptions, testTierOptions } from '../../vitest.tiers';

// docs/TESTING.md §5: the target for server is 90 % across the board. The floor below is what
// the package achieves today; it only ever moves up.
const COVERAGE_THRESHOLDS = { lines: 90, branches: 90, functions: 90, statements: 90 };

export default defineConfig({
  test: {
    globals: true,
    ...testTierOptions(),
    coverage: coverageOptions(COVERAGE_THRESHOLDS),
  },
});
