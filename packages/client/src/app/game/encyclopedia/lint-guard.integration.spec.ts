// @vitest-environment node
// docs/architecture/encyclopedia.md §12.6: the two lint blocks that keep numbers out of the encyclopedia, pinned
// against the repository's real `eslint.config.js`. ESLint runs in one child Node process over fixture sources (the
// test bundle never loads ESLint itself); each fixture lints under the path of an existing file, so the type-aware
// parser finds its project. The allowlist of shared names comes from the config and must share no balance key.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';

const ENCYCLOPEDIA = 'packages/client/src/app/game/encyclopedia';
const CONTENT_FILE = `${ENCYCLOPEDIA}/content/stage-entries.ts`;
const FACTS_FILE = `${ENCYCLOPEDIA}/facts/formula-table.ts`;
const REGISTRY_FILE = `${ENCYCLOPEDIA}/registry.ts`;
const CONTEXT_FILE = `${ENCYCLOPEDIA}/encyclopedia-context.ts`;
const QUANTITIES_FILE = 'packages/client/src/app/game/quantities/quantity-unit.ts';
/** The runner replaces this source with an import of every allowlisted name. */
const ALLOWLIST_IMPORT = '__ALLOWLIST_IMPORT__';
const IMPORTS = 'no-restricted-imports';
const SYNTAX = 'no-restricted-syntax';
const LIVE_BALANCE_TEXT = 'live balance';
const TIERS_TEXT = 'TRAIT_TIERS';
const CONTENT_TEXT = 'never a number or arithmetic';
const LINT_TIMEOUT_MS = 180_000;
/** The runner's JSON report: every fixture's messages. */
const LINT_OUTPUT_MAX_BYTES = 16 * 1024 * 1024;

const RUNNER = `
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const { ESLint } = await import(pathToFileURL(join(root, 'node_modules/eslint/lib/api.js')).href);
const { SHARED_NAMES_WITHOUT_A_BALANCE_KEY: allowlist } = await import(pathToFileURL(join(root, 'eslint.config.js')).href);
const fixtures = JSON.parse(readFileSync(0, 'utf8'));
const eslint = new ESLint({ cwd: root });
const results = [];
for (const fixture of fixtures) {
  const source = fixture.source === '${ALLOWLIST_IMPORT}'
    ? 'import { ' + allowlist.join(', ') + " } from '@evolution/shared';\\nexport const names = [" + allowlist.join(', ') + '];\\n'
    : fixture.source;
  const [result] = await eslint.lintText(source, { filePath: join(root, fixture.filePath) });
  results.push(result.messages.map((message) => ({ ruleId: message.ruleId, message: message.message })));
}
process.stdout.write(JSON.stringify({ allowlist, results }));
`;

interface Fixture {
  readonly name: string;
  readonly filePath: string;
  readonly source: string;
  /** The guard message expected (by rule and a fragment of its text), or `null` when no guard may fire. */
  readonly expected: { readonly ruleId: string; readonly text: string } | null;
}

const FIXTURES: readonly Fixture[] = [
  {
    name: 'a tunable import in content',
    filePath: CONTENT_FILE,
    source: "import { ALGAE_MASS } from '@evolution/shared';\nexport const mass = ALGAE_MASS;\n",
    expected: { ruleId: IMPORTS, text: LIVE_BALANCE_TEXT },
  },
  {
    name: 'a walk order import in facts',
    filePath: FACTS_FILE,
    source: "import { STAGE_ORDER } from '@evolution/shared';\nexport const order = STAGE_ORDER;\n",
    expected: { ruleId: IMPORTS, text: LIVE_BALANCE_TEXT },
  },
  {
    name: 'a catalog import in quantities',
    filePath: QUANTITIES_FILE,
    source: "import { TRAIT_CATALOG } from '@evolution/shared';\nexport const catalog = TRAIT_CATALOG;\n",
    expected: { ruleId: IMPORTS, text: LIVE_BALANCE_TEXT },
  },
  {
    name: 'DEFAULT_BALANCE outside the registry and the context',
    filePath: FACTS_FILE,
    source: "import { DEFAULT_BALANCE } from '@evolution/shared';\nexport const balance = DEFAULT_BALANCE;\n",
    expected: { ruleId: IMPORTS, text: LIVE_BALANCE_TEXT },
  },
  {
    name: 'DEFAULT_BALANCE in the registry',
    filePath: REGISTRY_FILE,
    source: "import { DEFAULT_BALANCE } from '@evolution/shared';\nexport const balance = DEFAULT_BALANCE;\n",
    expected: null,
  },
  { name: 'every allowlisted name in content', filePath: CONTENT_FILE, source: ALLOWLIST_IMPORT, expected: null },
  {
    name: 'a namespace import of shared in content',
    filePath: CONTENT_FILE,
    source: "import * as shared from '@evolution/shared';\nexport const kinds = shared.CELL_KIND;\n",
    expected: { ruleId: SYNTAX, text: LIVE_BALANCE_TEXT },
  },
  {
    name: 'a .tiers access in facts',
    filePath: FACTS_FILE,
    source: 'export const read = (row: { tiers: unknown }): unknown => row.tiers;\n',
    expected: { ruleId: SYNTAX, text: TIERS_TEXT },
  },
  {
    name: 'a .tiers access in content',
    filePath: CONTENT_FILE,
    source: 'export const read = (row: { tiers: unknown }): unknown => row.tiers;\n',
    expected: { ruleId: SYNTAX, text: TIERS_TEXT },
  },
  {
    name: 'a number literal in content',
    filePath: CONTENT_FILE,
    source: 'export const stageCount = 5;\n',
    expected: { ruleId: SYNTAX, text: CONTENT_TEXT },
  },
  {
    name: 'binary arithmetic in content',
    filePath: CONTENT_FILE,
    source: 'export const total = (first: number, second: number): number => first * second;\n',
    expected: { ruleId: SYNTAX, text: CONTENT_TEXT },
  },
  {
    name: 'a compound assignment in content',
    filePath: CONTENT_FILE,
    source:
      'export function grow(start: number, step: number): number {\n  let size = start;\n  size += step;\n  return size;\n}\n',
    expected: { ruleId: SYNTAX, text: CONTENT_TEXT },
  },
  {
    name: 'an increment in content',
    filePath: CONTENT_FILE,
    source: 'export function next(start: number): number {\n  let size = start;\n  size++;\n  return size;\n}\n',
    expected: { ruleId: SYNTAX, text: CONTENT_TEXT },
  },
  {
    name: 'an exponent in content',
    filePath: CONTENT_FILE,
    source: 'export const area = (side: number): number => side ** side;\n',
    expected: { ruleId: SYNTAX, text: CONTENT_TEXT },
  },
  {
    name: 'DEFAULT_BALANCE in the context',
    filePath: CONTEXT_FILE,
    source: "import { DEFAULT_BALANCE } from '@evolution/shared';\nexport const balance = DEFAULT_BALANCE;\n",
    expected: null,
  },
  { name: 'every allowlisted name in facts', filePath: FACTS_FILE, source: ALLOWLIST_IMPORT, expected: null },
  { name: 'every allowlisted name in quantities', filePath: QUANTITIES_FILE, source: ALLOWLIST_IMPORT, expected: null },
  {
    name: 'a number literal outside content',
    filePath: FACTS_FILE,
    source: 'export const stageCount = 5;\n',
    expected: null,
  },
];

interface LintMessage {
  readonly ruleId: string | null;
  readonly message: string;
}

function checkoutRoot(): string {
  let directory = process.cwd();
  while (!existsSync(join(directory, 'eslint.config.js'))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`eslint.config.js not found above ${process.cwd()}`);
    directory = parent;
  }
  return directory;
}

function runLint(): { readonly allowlist: readonly string[]; readonly results: readonly (readonly LintMessage[])[] } {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', RUNNER], {
    cwd: checkoutRoot(),
    input: JSON.stringify(FIXTURES.map(({ filePath, source }) => ({ filePath, source }))),
    encoding: 'utf8',
    maxBuffer: LINT_OUTPUT_MAX_BYTES,
  });
  return JSON.parse(output) as ReturnType<typeof runLint>;
}

describe('the encyclopedia lint guard', () => {
  let lint: ReturnType<typeof runLint> | null = null;
  const linted = (): ReturnType<typeof runLint> => (lint ??= runLint());

  it('shares no allowlisted name with a key of any DEFAULT_BALANCE domain', { timeout: LINT_TIMEOUT_MS }, () => {
    const { allowlist } = linted();
    expect(allowlist.length).toBeGreaterThan(0);
    const balanceKeys = Object.values(DEFAULT_BALANCE).flatMap((domain) => Object.keys(domain));
    for (const name of allowlist) expect(balanceKeys, name).not.toContain(name);
  });

  it.each(FIXTURES.map((fixture, index) => [fixture.name, index] as const))(
    'judges %s',
    { timeout: LINT_TIMEOUT_MS },
    (_name, index) => {
      const fixture = FIXTURES[index] as Fixture;
      const guardMessages = (linted().results[index] ?? []).filter(
        (message) => message.ruleId === IMPORTS || message.ruleId === SYNTAX,
      );
      if (fixture.expected === null) {
        expect(guardMessages).toEqual([]);
        return;
      }
      const { ruleId, text } = fixture.expected;
      expect(guardMessages.some((message) => message.ruleId === ruleId && message.message.includes(text))).toBe(true);
    },
  );
});
