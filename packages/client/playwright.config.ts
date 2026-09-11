// The renderer smoke (docs/TESTING.md §1, UI tier): headless Chromium against the dev servers (game
// server + Angular), a live room from the lobby. Run with `pnpm --filter @evolution/client smoke`; not part of `./validate.sh all`.
import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/** The host-selected ports (docs/CODE-STANDARDS.md §2): `PORTS.env` at the repo root is the one home. */
const PORTS_ENV_URL = new URL('../../PORTS.env', import.meta.url);

function portFromPortsEnv(name: string): number {
  const match = readFileSync(PORTS_ENV_URL, 'utf8').match(new RegExp(`^${name}=(\\d+)$`, 'm'));
  if (match?.[1] === undefined) throw new Error(`${name} is not set in PORTS.env`);
  return Number(match[1]);
}

/** `SMOKE_CLIENT_PORT` points the smoke at a second dev stack (a worktree beside a live one); `PORTS.env` otherwise. */
const CLIENT_PORT = Number(process.env['SMOKE_CLIENT_PORT']) || portFromPortsEnv('CLIENT_PORT');
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
