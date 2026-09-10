// Writes data/balance.json from DEFAULT_BALANCE (docs/ARCHITECTURE.md §9, docs/CODE-STANDARDS.md §2).
// The file is the diffable reference the debug tools quote; nothing reads it at runtime, and
// balance.test.ts fails the gate when it drifts from the constants.
//
//   pnpm generate:balance        (builds the shared package, then runs this with Node's type stripping)
//
// It imports the built package so it runs on plain `node`, without a TypeScript loader.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { DEFAULT_BALANCE } from '../packages/shared/dist/index.js';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = resolve(REPOSITORY_ROOT, 'data', 'balance.json');

async function main(): Promise<void> {
  const prettierOptions = (await resolveConfig(OUTPUT_PATH)) ?? {};
  const json = await format(JSON.stringify(DEFAULT_BALANCE), { ...prettierOptions, filepath: OUTPUT_PATH });
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, json);
  console.warn(`wrote ${OUTPUT_PATH}`);
}

await main();
