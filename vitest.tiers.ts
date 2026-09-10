// Shared vitest wiring for the unit / integration tiers and coverage (docs/TESTING.md).
// Each package's vitest.config.ts spreads these so the tier rules are defined once.
import { configDefaults, type ViteUserConfig } from 'vitest/config';

type TestOptions = NonNullable<ViteUserConfig['test']>;
type CoverageThresholds = { lines: number; branches: number; functions: number; statements: number };

/** `RUN_INTEGRATION=1` (set by `./validate.sh integration`) swaps the unit tier for the integration tier. */
export const IS_INTEGRATION_RUN = process.env.RUN_INTEGRATION === '1';

export const UNIT_TEST_GLOBS = ['src/**/*.test.ts', 'src/**/*.spec.ts'];
export const INTEGRATION_TEST_GLOBS = ['src/**/*.integration.test.ts', 'src/**/*.integration.spec.ts'];
/**
 * Gameplay scenarios (docs/TESTING.md §8) step a real module for thousands of ticks, so they run
 * with the integration tier rather than on every save; the suffix keeps them selectable on their own.
 */
export const GAMEPLAY_TEST_GLOBS = ['src/**/*.gameplay.test.ts'];
/** Everything the opt-in `./validate.sh integration` run executes. */
export const OPT_IN_TEST_GLOBS = [...INTEGRATION_TEST_GLOBS, ...GAMEPLAY_TEST_GLOBS];

/**
 * The test doubles under `src/testing/` that hold no logic: the builders (plain, bot and real-socket),
 * the fake socket and the gameplay scenario tables (docs/TESTING.md §4). The gameplay framework itself
 * (`src/testing/gameplay/**`) is real logic and is measured like any other source.
 */
export const TEST_DOUBLE_GLOBS = [
  'src/testing/builders.ts',
  'src/testing/bot-builders.ts',
  'src/testing/socket-builders.ts',
  'src/testing/fake-websocket.ts',
  'src/testing/scenarios/**',
];

/** Not logic: barrels, the composition roots named `index.ts`, the test doubles, declarations and the tests themselves. */
export const COVERAGE_EXCLUDE = [...UNIT_TEST_GLOBS, 'src/**/index.ts', ...TEST_DOUBLE_GLOBS, 'src/**/*.d.ts'];

/** `include` / `exclude` for the tier this run is in. The opt-in tier passes when a package has none yet. */
export function testTierOptions(): Pick<TestOptions, 'include' | 'exclude' | 'passWithNoTests'> {
  if (IS_INTEGRATION_RUN) {
    return { include: OPT_IN_TEST_GLOBS, exclude: [...configDefaults.exclude], passWithNoTests: true };
  }
  return { include: UNIT_TEST_GLOBS, exclude: [...configDefaults.exclude, ...OPT_IN_TEST_GLOBS] };
}

/** v8 coverage with the package's thresholds; off for integration runs, which measure wiring, not lines. */
export function coverageOptions(thresholds: CoverageThresholds): TestOptions['coverage'] {
  return {
    provider: 'v8',
    enabled: !IS_INTEGRATION_RUN,
    include: ['src/**/*.ts'],
    exclude: COVERAGE_EXCLUDE,
    thresholds,
    reporter: ['text-summary'],
  };
}
