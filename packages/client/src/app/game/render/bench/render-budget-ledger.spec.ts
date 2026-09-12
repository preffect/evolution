// The budget ledger (docs/CODE-STANDARDS.md §2): every number of docs/RENDERING.md §6–§7 that the
// bench asserts is read from the doc's own tables here and pinned against the constants, so the
// doc and the code cannot drift silently.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RENDER_STAGE_NAMES } from '@evolution/shared';
import {
  RENDER_BENCH_CELL_COUNT,
  RENDER_BENCH_MOTE_COUNT,
  RENDER_BENCH_SEED,
  RENDER_FRAME_BUDGET_P95_MS,
  RENDER_GPU_BUDGET_MS,
  RENDER_GPU_SAMPLE_MAX_FRAME_RATIO,
  RENDER_HUD_BUDGET_MS,
  RENDER_MAX_DRAW_CALLS,
  RENDER_P95_MIN_SAMPLE_FRAMES,
  RENDER_STAGE_BUDGET_MS,
} from '../constants';

const RENDERING_DOCUMENT_PATH = join('docs', 'RENDERING.md');

/** The repo root: the test runner's cwd is a package or the root, so walk up to the doc. */
function renderingDocumentPath(): string {
  let directory = process.cwd();
  while (!existsSync(join(directory, RENDERING_DOCUMENT_PATH))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`${RENDERING_DOCUMENT_PATH} not found above ${process.cwd()}`);
    directory = parent;
  }
  return join(directory, RENDERING_DOCUMENT_PATH);
}

const rendering = readFileSync(renderingDocumentPath(), 'utf8');

function section(heading: string): string {
  const start = rendering.indexOf(`\n## ${heading}`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const rest = rendering.slice(start + 1);
  const end = rest.indexOf('\n## ');
  return end < 0 ? rest : rest.slice(0, end);
}

/** The digits of a doc number, whatever the thousands separator ("1 400"). */
function numberIn(text: string, pattern: RegExp): number {
  const match = pattern.exec(text);
  expect(match?.[1], String(pattern)).toBeDefined();
  return Number(match![1]!.replace(/[^\d.]/g, ''));
}

describe('docs/RENDERING.md §7 budgets', () => {
  const budgetSection = section('7. Frame budget');

  it('names the frame target, the GPU and the HUD budgets the verdict applies', () => {
    expect(numberIn(budgetSection, /≤ (\d+) ms p95 frame/)).toBe(RENDER_FRAME_BUDGET_P95_MS);
    expect(numberIn(budgetSection, /\| `gpuMs` \(its own field\)\s*\|\s*([\d.]+)/)).toBe(RENDER_GPU_BUDGET_MS);
    expect(numberIn(budgetSection, /\| HUD \(Angular[^|]*\|\s*([\d.]+)/)).toBe(RENDER_HUD_BUDGET_MS);
  });

  it('states the two rules that decide whether a number is reportable at all', () => {
    expect(numberIn(budgetSection, /`RENDER_P95_MIN_SAMPLE_FRAMES` frames \(\*\*(\d+)\*\*/)).toBe(
      RENDER_P95_MIN_SAMPLE_FRAMES,
    );
    expect(numberIn(budgetSection, /`RENDER_GPU_SAMPLE_MAX_FRAME_RATIO` \(\*\*(\d+)×\*\*\)/)).toBe(
      RENDER_GPU_SAMPLE_MAX_FRAME_RATIO,
    );
  });

  it.each(RENDER_STAGE_NAMES)('budgets the `%s` stage as its table row does', (stage) => {
    expect(numberIn(budgetSection, new RegExp(`\\| \`${stage}\`[^|]*\\|\\s*([\\d.]+)`))).toBe(
      RENDER_STAGE_BUDGET_MS[stage],
    );
  });

  it('states the headroom as the target minus the stages, the GPU and the HUD', () => {
    const stagesTotal = RENDER_STAGE_NAMES.reduce((sum, stage) => sum + RENDER_STAGE_BUDGET_MS[stage], 0);
    const headroom = RENDER_FRAME_BUDGET_P95_MS - stagesTotal - RENDER_GPU_BUDGET_MS - RENDER_HUD_BUDGET_MS;
    expect(numberIn(budgetSection, /\| headroom\s*\|\s*([\d.]+)/)).toBeCloseTo(headroom, 9);
  });

  it('names the bench load and the route seed', () => {
    expect(numberIn(budgetSection, /`RENDER_BENCH_CELL_COUNT` ([\d ]+)/)).toBe(RENDER_BENCH_CELL_COUNT);
    expect(numberIn(budgetSection, /`RENDER_BENCH_MOTE_COUNT` ([\d ]+)/)).toBe(RENDER_BENCH_MOTE_COUNT);
    expect(numberIn(budgetSection, /`RENDER_BENCH_SEED` \((\d+)\)/)).toBe(RENDER_BENCH_SEED);
  });
});

describe('docs/RENDERING.md §6 draw calls', () => {
  it('caps the draw calls at the total the batching table adds up to', () => {
    expect(numberIn(section('6. Batching plan'), /Total \*\*≤ (\d+) draw calls\*\*/)).toBe(RENDER_MAX_DRAW_CALLS);
  });
});
