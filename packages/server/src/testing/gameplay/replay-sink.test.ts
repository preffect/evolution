import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { StateHash } from '@evolution/shared';
import { SCENARIO_REPLAY_FORMAT_VERSION, type ScenarioReplay } from './replay-format.js';
import {
  createFileReplaySink,
  createMemoryReplaySink,
  DEFAULT_REPLAY_DIRECTORY,
  replayFileName,
} from './replay-sink.js';

const REPLAY: ScenarioReplay = {
  version: SCENARIO_REPLAY_FORMAT_VERSION,
  scenarioName: 'E9: A absorbs B (30 ticks)',
  seed: 42,
  config: { maxPlayers: 8 },
  roster: [],
  fixtures: [],
  membership: [],
  inputs: [],
  checkpoints: [],
  finalTick: 0,
  finalHash: '0000000000000000' as StateHash,
};

describe('replay sinks', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('slugs the scenario name into a replay file name', () => {
    expect(replayFileName(REPLAY.scenarioName)).toBe('e9-a-absorbs-b-30-ticks.replay.json');
    expect(replayFileName('  Late join  ')).toBe('late-join.replay.json');
  });

  it('defaults to qa/replays at the repository root', () => {
    expect(DEFAULT_REPLAY_DIRECTORY.endsWith('/qa/replays/')).toBe(true);
    expect(DEFAULT_REPLAY_DIRECTORY).not.toContain('packages');
  });

  it('writes the replay as indented JSON into the directory, creating it', () => {
    const root = mkdtempSync(join(tmpdir(), 'replay-sink-'));
    temporaryDirectories.push(root);
    const directory = join(root, 'nested', 'replays');
    const path = createFileReplaySink(directory).write(REPLAY);
    expect(path).toBe(join(directory, 'e9-a-absorbs-b-30-ticks.replay.json'));
    const written = readFileSync(path as string, 'utf8');
    expect(JSON.parse(written)).toEqual(REPLAY);
    expect(written).toContain('\n  "seed": 42');
  });

  it('keeps replays in memory and reports no path', () => {
    const sink = createMemoryReplaySink();
    expect(sink.write(REPLAY)).toBeNull();
    expect(sink.replays).toEqual([REPLAY]);
  });
});
