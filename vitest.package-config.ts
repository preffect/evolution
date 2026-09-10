import { defineConfig, type ViteUserConfig } from 'vitest/config';

// One vitest config for every package (docs/ENGINEERING.md §2.2): unit tests by default;
// `./validate.sh integration` sets RUN_INTEGRATION=1 to run only `*.integration.test.ts`.
const INTEGRATION_PATTERN = 'src/**/*.integration.test.ts';
const UNIT_PATTERN = 'src/**/*.test.ts';

export function createPackageVitestConfig(): ViteUserConfig {
  const runIntegration = process.env['RUN_INTEGRATION'] === '1';
  return defineConfig({
    test: {
      globals: true,
      include: runIntegration ? [INTEGRATION_PATTERN] : [UNIT_PATTERN],
      exclude: runIntegration ? ['**/node_modules/**'] : ['**/node_modules/**', INTEGRATION_PATTERN],
      passWithNoTests: runIntegration,
    },
  });
}
