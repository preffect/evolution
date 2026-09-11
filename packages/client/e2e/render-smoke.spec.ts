// The renderer smoke (docs/TESTING.md, docs/RENDERING.md §7, §9): the bench route draws the
// fixed-seed scene, the debug hook parks and steps it deterministically (two renders of the same
// tick are pixel-identical, a step changes the frame), the shader compiles on SwiftShader, the
// budget report lands in the DOM, and screenshots land under `.qa/screenshots/` for the PR.
import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = '../../.qa/screenshots';
const BENCH_SEED = 42;
const BENCH_TICK = 120;
const ZOOMS = [1.8, 1, 0.36] as const;
const REPORT_TIMEOUT_MS = 90_000;

interface DebugWindow {
  __evolutionDebug?: {
    pause(): void;
    step(frames?: number): void;
    renderTick(): number | null;
    isPaused(): boolean;
  };
}

async function openBench(page: Page, zoom: number): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`/?bench=${BENCH_SEED}&tick=${BENCH_TICK}&zoom=${zoom}`);
  await expect(page.getByTestId('render-bench')).toBeVisible();
  await expect(page.locator('canvas[data-testid="game-canvas"]')).toBeVisible();
  await page.waitForFunction(() => (window as DebugWindow).__evolutionDebug?.renderTick() !== null);
  expect(errors, 'no page or shader errors').toEqual([]);
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

test.describe('renderer smoke on the bench route', () => {
  for (const zoom of ZOOMS) {
    test(`draws the bench scene at zoom ${zoom} and screenshots it`, async ({ page }) => {
      await openBench(page, zoom);
      await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/pr99-bench-seed${BENCH_SEED}-tick${BENCH_TICK}-zoom${zoom}.png`,
      });
    });
  }

  test('renders the same tick identically and a stepped tick differently', async ({ page }) => {
    await openBench(page, 1);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.step(1));
    await page.waitForTimeout(100);
    const first = await canvasHash(page);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.step(1));
    await page.waitForTimeout(100);
    const secondSameTick = await canvasHash(page);
    expect(await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.isPaused())).toBe(true);
    expect(secondSameTick).toBe(first);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.step(30));
    await page.waitForTimeout(100);
    expect(await canvasHash(page)).not.toBe(first);
  });

  test('reports the frame budget in the DOM after the warm-up', async ({ page }) => {
    await openBench(page, 1);
    const report = page.getByTestId('render-bench-report');
    await expect(report).not.toBeEmpty({ timeout: REPORT_TIMEOUT_MS });
    const parsed = JSON.parse((await report.textContent()) ?? '{}') as {
      renderStagesMs: Record<string, number>;
      drawCalls: number;
      visibleCells: number;
    };
    expect(Object.keys(parsed.renderStagesMs).sort()).toEqual([
      'camera',
      'cells',
      'effects',
      'food',
      'net',
      'organelles',
      'submit',
    ]);
    expect(parsed.visibleCells).toBeGreaterThan(0);
    expect(parsed.drawCalls).toBeGreaterThan(0);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/pr99-bench-report.png` });
    test.info().annotations.push({ type: 'render-bench-report', description: JSON.stringify(parsed) });
  });
});
