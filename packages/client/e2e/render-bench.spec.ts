// The bench route smoke (docs/TESTING.md §1 UI tier, docs/RENDERING.md §7, §9): the fixed-seed scene draws
// on SwiftShader without page or shader errors, two renders of the same tick are pixel-identical and a
// step changes the frame, the frame-budget report lands in the DOM with every stage key, the draw calls
// stay under the §6 ceiling, and the report and screenshots land under `.qa/screenshots/` for the PR.
// Absolute times are not asserted: the box's load decides them, the PR states the load beside them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = '../../.qa/screenshots';
const BENCH_SEED = 42;
const BENCH_TICK = 120;
/** VISUAL-STYLE §9's three zoom bands. */
const ZOOMS = [1.8, 1, 0.36] as const;
/**
 * The report's window on SwiftShader: a loaded box renders a 1080p bench frame in seconds, so the smoke shortens the
 * 240-frame window (`window=`) and only proves the harness; the numbers come from a hardware run at the full window.
 */
const SMOKE_WINDOW_FRAMES = 24;
/** Every bench test renders the full load through SwiftShader: minutes on a loaded box, so each gets this. */
const BENCH_TEST_TIMEOUT_MS = 900_000;
const HOLD_WAIT_MS = 300;
/** `RENDER_MAX_DRAW_CALLS` (docs/RENDERING.md §6); the spec runs outside the app's module graph, so the number is restated here. */
const MAX_DRAW_CALLS = 17;
const RENDER_STAGE_KEYS = ['camera', 'cells', 'effects', 'food', 'net', 'organelles', 'submit'];

interface DebugWindow {
  __evolutionDebug?: {
    pause(): void;
    step(frames?: number): void;
    renderTick(): number | null;
    isPaused(): boolean;
    framesRendered(): number;
  };
}

interface BenchReport {
  readonly frames: number;
  readonly renderStagesMs: Record<string, number>;
  readonly frameTimeP95Ms: number;
  readonly gpuMs: number | null;
  readonly drawCalls: number;
  readonly visibleCells: number;
  readonly visibleMotes: number;
  readonly allocatedBytesPerFrame: number | null;
  readonly verdict: { readonly isWithinBudget: boolean; readonly overruns: readonly { readonly name: string }[] };
}

async function openBench(page: Page, zoom: number, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`/?bench=${BENCH_SEED}&tick=${BENCH_TICK}&zoom=${zoom}${query}`);
  await expect(page.getByTestId('render-bench')).toBeVisible();
  await expect(page.locator('canvas[data-testid="game-canvas"]')).toBeVisible();
  await page.waitForFunction(() => (window as DebugWindow).__evolutionDebug?.renderTick() !== null);
  return errors;
}

async function canvasHash(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-testid="game-canvas"]') as HTMLCanvasElement;
    const data = canvas.toDataURL('image/png');
    let hash = 0;
    for (let index = 0; index < data.length; index += 1) hash = (hash * 31 + data.charCodeAt(index)) | 0;
    return `${data.length}:${hash}`;
  });
}

function framesRendered(page: Page): Promise<number> {
  return page.evaluate(() => (window as DebugWindow).__evolutionDebug?.framesRendered() ?? 0);
}

/** Steps the scene and waits for the stepped frame to be submitted (seconds each on SwiftShader), not a fixed delay. */
async function stepAndSettle(page: Page, ticks: number): Promise<void> {
  const before = await framesRendered(page);
  await page.evaluate((count) => (window as DebugWindow).__evolutionDebug?.step(count), ticks);
  await page.waitForFunction(
    (count) => ((window as DebugWindow).__evolutionDebug?.framesRendered() ?? 0) > count,
    before,
    { timeout: BENCH_TEST_TIMEOUT_MS },
  );
}

test.describe('renderer smoke on the bench route', () => {
  test.setTimeout(BENCH_TEST_TIMEOUT_MS);

  for (const zoom of ZOOMS) {
    test(`draws the bench scene at zoom ${zoom} without errors and screenshots it`, async ({ page }) => {
      const errors = await openBench(page, zoom);
      await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
      await page.waitForTimeout(HOLD_WAIT_MS);
      expect(errors, 'no page or shader errors').toEqual([]);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/render-bench-seed${BENCH_SEED}-tick${BENCH_TICK}-zoom${zoom}.png`,
      });
    });
  }

  test('renders the same tick identically and a stepped tick differently', async ({ page }) => {
    await openBench(page, 1);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
    await stepAndSettle(page, 1);
    const first = await canvasHash(page);
    const firstTick = await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.renderTick());
    await stepAndSettle(page, 0);
    expect(await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.isPaused())).toBe(true);
    expect(await canvasHash(page), 'a re-render of the parked tick').toBe(first);
    await stepAndSettle(page, 30);
    expect(await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.renderTick())).toBe(
      (firstTick ?? 0) + 30,
    );
    expect(await canvasHash(page)).not.toBe(first);
    await stepAndSettle(page, 0);
    // Back on the same tick from a fresh page: the frame is a pure function of seed, tick and zoom.
    await page.goto(`/?bench=${BENCH_SEED}&tick=${(firstTick ?? 0) + 30}&zoom=1`);
    await page.waitForFunction(() => (window as DebugWindow).__evolutionDebug?.renderTick() !== null);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
    await stepAndSettle(page, 0);
    const reloaded = await canvasHash(page);
    await stepAndSettle(page, 0);
    expect(await canvasHash(page), 'the same tick after a fresh load').toBe(reloaded);
  });

  test('reports the frame budget in the DOM after the warm-up, under the draw-call ceiling', async ({ page }) => {
    const windowFrames = Number(process.env['BENCH_WINDOW_FRAMES']) || SMOKE_WINDOW_FRAMES;
    await openBench(page, 1, `&window=${windowFrames}`);
    const report = page.getByTestId('render-bench-report');
    await expect(report).not.toBeEmpty({ timeout: BENCH_TEST_TIMEOUT_MS });
    const parsed = JSON.parse((await report.textContent()) ?? '{}') as BenchReport;
    expect(parsed.frames).toBe(windowFrames);
    expect(Object.keys(parsed.renderStagesMs).sort()).toEqual(RENDER_STAGE_KEYS);
    expect(parsed.visibleCells).toBeGreaterThan(0);
    expect(parsed.visibleMotes).toBeGreaterThan(0);
    expect(parsed.drawCalls).toBeGreaterThan(0);
    expect(parsed.drawCalls).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    expect(parsed.verdict.overruns.map((overrun) => overrun.name)).not.toContain('drawCalls');
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    writeFileSync(`${SCREENSHOT_DIR}/render-bench-report.json`, JSON.stringify(parsed, null, 2));
    test.info().annotations.push({ type: 'render-bench-report', description: JSON.stringify(parsed) });
  });
});
