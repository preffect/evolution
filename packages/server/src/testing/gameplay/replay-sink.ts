// Where a failing scenario's replay goes (docs/DETERMINISM.md §6): `qa/replays/<scenario>.replay.json`
// by default, an in-memory list in the framework's own tests. The sink is injected so the runner
// never touches the file system on its own.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEBUG_JSON_INDENT_SPACES } from '@evolution/shared';
import type { ScenarioReplay } from './replay-format.js';

export interface ReplaySink {
  /** Stores the replay and returns where it went (a path, or `null` for a memory sink). */
  write(replay: ScenarioReplay): string | null;
}

const REPLAY_FILE_SUFFIX = '.replay.json';
const FILE_NAME_SEPARATOR = '-';
const NON_FILE_NAME_CHARACTERS = /[^a-z0-9]+/g;
const EDGE_SEPARATORS = /^-+|-+$/g;
/** From `packages/server/src/testing/gameplay/` up to the repository root. */
const REPO_ROOT_FROM_HERE = '../../../../../';
export const DEFAULT_REPLAY_DIRECTORY = fileURLToPath(new URL(`${REPO_ROOT_FROM_HERE}qa/replays/`, import.meta.url));

/** `"E9: two placed cells"` → `e9-two-placed-cells.replay.json`. */
export function replayFileName(scenarioName: string): string {
  const slug = scenarioName
    .toLowerCase()
    .replace(NON_FILE_NAME_CHARACTERS, FILE_NAME_SEPARATOR)
    .replace(EDGE_SEPARATORS, '');
  return `${slug}${REPLAY_FILE_SUFFIX}`;
}

export function createFileReplaySink(directory = DEFAULT_REPLAY_DIRECTORY): ReplaySink {
  return {
    write: (replay) => {
      mkdirSync(directory, { recursive: true });
      const path = join(directory, replayFileName(replay.scenarioName));
      writeFileSync(path, JSON.stringify(replay, null, DEBUG_JSON_INDENT_SPACES));
      return path;
    },
  };
}

export function createMemoryReplaySink(): ReplaySink & { readonly replays: ScenarioReplay[] } {
  const replays: ScenarioReplay[] = [];
  return {
    replays,
    write: (replay) => {
      replays.push(replay);
      return null;
    },
  };
}
