// The renderer smoke (docs/TESTING.md §1, UI tier): headless Chromium against the dev servers (game
// server + Angular), a live room from the lobby. Run with `pnpm --filter @evolution/client smoke`; not part of `./validate.sh all`.
import { defineConfig } from '@playwright/test';

const CLIENT_PORT = 4402;
const SMOKE_VIEWPORT = { width: 1920, height: 1080 };

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '../../.qa/scratch/playwright-output',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    viewport: SMOKE_VIEWPORT,
    deviceScaleFactor: 1,
    headless: true,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'pnpm -w dev',
    url: `http://localhost:${CLIENT_PORT}/`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
