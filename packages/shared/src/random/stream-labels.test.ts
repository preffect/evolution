import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COSMETIC_SUB_STREAM,
  RANDOM_STREAM,
  RANDOM_STREAM_LABELS,
  SERVER_RANDOM_STREAM_LABELS,
} from './stream-labels.js';

const DETERMINISM_DOC = new URL('../../../../docs/DETERMINISM.md', import.meta.url);
const LEDGER_BLOCK_START = 'export const RANDOM_STREAM = {';
const LEDGER_BLOCK_END = '} as const;';
/** `  spawner: 'spawner', // food and fragment spawns ...`: the key and the wire label of one documented row. */
const LEDGER_ROW_PATTERN = /^\s*([a-zA-Z]+):\s*'([a-z_]+)',/;

/** The `RANDOM_STREAM` declaration of docs/DETERMINISM.md §3, as `[key, label]` pairs in doc order. */
function documentedStreams(): [string, string][] {
  const lines = readFileSync(DETERMINISM_DOC, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith(LEDGER_BLOCK_START));
  expect(start, `"${LEDGER_BLOCK_START}" in DETERMINISM.md`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith(LEDGER_BLOCK_END));
  expect(end, `"${LEDGER_BLOCK_END}" after it`).toBeGreaterThanOrEqual(0);
  const rows: [string, string][] = [];
  for (const line of rest.slice(0, end)) {
    const match = LEDGER_ROW_PATTERN.exec(line);
    if (match) {
      rows.push([match[1] as string, match[2] as string]);
    }
  }
  return rows;
}

describe('RANDOM_STREAM', () => {
  it('lists every label exactly once in declared order', () => {
    expect(RANDOM_STREAM_LABELS).toEqual(Object.values(RANDOM_STREAM));
    expect(new Set(RANDOM_STREAM_LABELS).size).toBe(RANDOM_STREAM_LABELS.length);
  });

  it('uses snake_case wire values', () => {
    for (const label of RANDOM_STREAM_LABELS) {
      expect(label).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it('lists every cosmetic sub-stream once, as a snake_case label, with the per-cell fork among them', () => {
    const labels = Object.values(COSMETIC_SUB_STREAM);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/^[a-z]+(_[a-z]+)*$/);
    expect(labels).toContain(COSMETIC_SUB_STREAM.cell);
    expect(labels).not.toContain(RANDOM_STREAM.cosmetic);
  });

  /**
   * The ledger (#170, the pattern of `constants/constants-ledger.test.ts`): the `engulf` stream was
   * documented by #151 and only declared here by #258, so the doc and the code are pinned to each
   * other rather than trusted to agree.
   */
  it('declares exactly the streams docs/DETERMINISM.md §3 documents, with their labels, in doc order', () => {
    const documented = documentedStreams();
    expect(documented.length).toBeGreaterThan(0);
    expect(Object.entries(RANDOM_STREAM)).toEqual(documented);
  });

  it('keeps the cosmetic stream off the server list and nothing else', () => {
    expect(SERVER_RANDOM_STREAM_LABELS).not.toContain(RANDOM_STREAM.cosmetic);
    expect([...SERVER_RANDOM_STREAM_LABELS, RANDOM_STREAM.cosmetic]).toEqual(RANDOM_STREAM_LABELS);
  });
});
