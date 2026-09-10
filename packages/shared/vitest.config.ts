import { defineConfig } from 'vitest/config';
import { coverageOptions, testTierOptions } from '../../vitest.tiers';

// docs/TESTING.md §5: the target for shared is 95 % across the board. The floor below is what
// the package achieves today; it only ever moves up.
const COVERAGE_THRESHOLDS = { lines: 95, branches: 95, functions: 95, statements: 95 };

export default defineConfig({
  test: {
    globals: true,
    ...testTierOptions(),
    coverage: coverageOptions(COVERAGE_THRESHOLDS),
  },
});
