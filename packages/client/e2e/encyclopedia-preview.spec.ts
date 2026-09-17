// The encyclopedia preview smoke (docs/architecture/encyclopedia.md §12.7, §12.9; docs/testing/tiers-and-builders.md §1,
// UI tier): the evidence route draws a real `GameRenderer` frame on SwiftShader with no room and no socket.
//
// **No absolute time is judged here.** The container's browser is SwiftShader — a CPU rasteriser at roughly a
// second a frame — so the open and frame numbers it reports are not the numbers the budgets are about. This spec
// asserts the report's **shape** (every key present, every value finite) and the behaviours that do not depend on
// how fast the box is: determinism at a tick, the canvas clamp, the context-leak loop, and no errors. The
// absolute numbers come from a hardware run of the same URL (docs/rendering/budget.md §7).

import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = '../../.qa/screenshots';
const PREVIEW_TEST_ID = 'encyclopedia-preview';
const REPORT_TEST_ID = 'encyclopedia-preview-report';
const CANVAS = 'canvas[data-testid="game-canvas"]';

/** `PREVIEW_CANVAS_MAX_PX` (docs/architecture/encyclopedia.md §12.7); the spec runs outside the app's module graph. */
const CANVAS_MAX_DEVICE_PX = 900;
/** `RENDER_STAGE` (docs/rendering/budget.md §7), restated here for the same reason. */
const RENDER_STAGE_KEYS = ['camera', 'cells', 'effects', 'food', 'net', 'organelles', 'submit'];

/** Each open is a whole bundle bake plus a SwiftShader submit; twenty of them is a long run on a loaded box. */
const PREVIEW_TEST_TIMEOUT_MS = 1_800_000;

/**
 * Every subject scene family ticket #363 builds. The registry holds `trait:`, `stage:` and `dna_tag:` entries
 * today, so a real entry anchor covers the cell and fragment families; the bare scene names (`?preview=food`,
 * `?preview=zone`) cover the two the content tickets have not reached, which is what they are for.
 */
const SCENE_ANCHORS = [
  { name: 'cell-trait', anchor: 'trait:cilia', scene: 'cell' },
  { name: 'cell-stage', anchor: 'stage:eukaryote', scene: 'cell' },
  { name: 'dna-fragment', anchor: 'dna_tag:motile', scene: 'dna_fragment' },
  { name: 'food', anchor: 'food', scene: 'food' },
  { name: 'zone', anchor: 'zone', scene: 'zone' },
] as const;

interface OpenTimings {
  readonly initMs: number;
  readonly bakeMs: number;
  readonly firstSubmitMs: number;
  readonly openedToFirstFrameMs: number;
}

interface PreviewReport {
  readonly anchor: string | null;
  readonly scene: string;
  readonly parkAtSeconds: number;
  readonly walkFrames: number;
  readonly opens: number;
  readonly coldOpen: OpenTimings;
  readonly warmOpens: readonly OpenTimings[];
  readonly openP95Ms: number | null;
  readonly frame: {
    readonly renderStagesMs: Record<string, number>;
    readonly frameTimeP95Ms: number;
    readonly drawCalls: number;
  };
  readonly budgets: { readonly openMs: number; readonly frameMs: number };
  readonly verdict: { readonly open: boolean | null; readonly frame: boolean | null };
}

function previewUrl(anchor: string, parkAtSeconds: number, opens = 1): string {
  return `/?preview=${encodeURIComponent(anchor)}&t=${parkAtSeconds}&opens=${opens}`;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/** The report lands once the last session has parked, which is the signal that a frame is on the canvas. */
async function openPreview(page: Page, url: string): Promise<PreviewReport> {
  await page.goto(url);
  await expect(page.getByTestId(PREVIEW_TEST_ID)).toBeVisible();
  await expect(page.locator(CANVAS)).toBeVisible();
  await page.waitForFunction(
    (testId) => (document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '') !== '',
    REPORT_TEST_ID,
    { timeout: PREVIEW_TEST_TIMEOUT_MS },
  );
  return JSON.parse((await page.getByTestId(REPORT_TEST_ID).textContent()) ?? '{}') as PreviewReport;
}

/** The canvas's own buffer, the full square: the CSS crop around it does not touch what `toDataURL` reads. */
function canvasHash(page: Page): Promise<string> {
  return page.evaluate((selector) => {
    const canvas = document.querySelector(selector) as HTMLCanvasElement;
    const data = canvas.toDataURL('image/png');
    let hash = 0;
    for (let index = 0; index < data.length; index += 1) hash = (hash * 31 + data.charCodeAt(index)) | 0;
    return `${data.length}:${hash}`;
  }, CANVAS);
}

test.describe('the encyclopedia preview evidence route', () => {
  test.setTimeout(PREVIEW_TEST_TIMEOUT_MS);

  test('draws every subject scene with no page or shader errors, and screenshots the lens', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    for (const scene of SCENE_ANCHORS) {
      const errors = watchErrors(page);
      const report = await openPreview(page, previewUrl(scene.anchor, 1));
      expect(errors, `${scene.name}: page and shader errors`).toEqual([]);
      expect(report.scene, `${scene.name}: the anchor reached its own scene family`).toBe(scene.scene);
      // The lens element, so the screenshot shows the round crop the player sees, not the square buffer.
      await page.getByTestId(PREVIEW_TEST_ID).screenshot({ path: `${SCREENSHOT_DIR}/preview-${scene.name}.png` });
      writeFileSync(`${SCREENSHOT_DIR}/preview-${scene.name}.json`, JSON.stringify(report, null, 2));
    }
  });

  test('draws the same pixels for the same t, and different pixels for a different t', async ({ page }) => {
    const PARK_SECONDS = 1;
    const OTHER_PARK_SECONDS = 2.5;
    await openPreview(page, previewUrl('trait:cilia', PARK_SECONDS));
    const first = await canvasHash(page);
    await openPreview(page, previewUrl('trait:cilia', PARK_SECONDS));
    expect(await canvasHash(page), 'two fresh loads at the same t').toBe(first);
    await openPreview(page, previewUrl('trait:cilia', OTHER_PARK_SECONDS));
    expect(await canvasHash(page), 'a different t moves the scene').not.toBe(first);
  });

  test('clamps the canvas to PREVIEW_CANVAS_MAX_PX device pixels on a 3x display', async ({ browser }) => {
    const context = await browser.newContext({ deviceScaleFactor: 3 });
    const page = await context.newPage();
    await openPreview(page, previewUrl('zone', 1));
    const size = await page.evaluate((selector) => {
      const canvas = document.querySelector(selector) as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    }, CANVAS);
    expect(size.width).toBeLessThanOrEqual(CANVAS_MAX_DEVICE_PX);
    expect(size.height).toBeLessThanOrEqual(CANVAS_MAX_DEVICE_PX);
    // The DPR cap is 2, so a 3x display gets a 2x buffer for its CSS square, never a 3x one.
    expect(size.width).toBeLessThan(await page.evaluate(() => window.devicePixelRatio * 360));
    await context.close();
  });

  test('has the report’s shape: every key present and every value finite', async ({ page }) => {
    const OPENS = 4;
    const report = await openPreview(page, previewUrl('zone', 1, OPENS));
    expect(report.scene).toBe('zone');
    expect(report.opens).toBe(OPENS);
    expect(report.walkFrames).toBeGreaterThan(0);
    expect(report.warmOpens).toHaveLength(OPENS - 1);
    for (const open of [report.coldOpen, ...report.warmOpens]) {
      for (const [key, value] of Object.entries(open)) {
        expect(Number.isFinite(value), `${key} reported and finite`).toBe(true);
      }
    }
    expect(Number.isFinite(report.openP95Ms ?? Number.NaN)).toBe(true);
    expect(Object.keys(report.frame.renderStagesMs).sort()).toEqual(RENDER_STAGE_KEYS);
    for (const [stage, value] of Object.entries(report.frame.renderStagesMs)) {
      expect(Number.isFinite(value), `${stage} reported and finite`).toBe(true);
    }
    expect(Number.isFinite(report.frame.frameTimeP95Ms)).toBe(true);
    expect(report.frame.drawCalls).toBeGreaterThan(0);
    expect(report.budgets.openMs).toBeGreaterThan(0);
    expect(report.budgets.frameMs).toBeGreaterThan(0);
    // The verdict is reported but never judged here: SwiftShader is not the reference GPU (§7).
    expect(report.verdict).toHaveProperty('open');
    expect(report.verdict).toHaveProperty('frame');
  });

  /** The leak loop: a browser caps live WebGL contexts at 16, and warns before it starts dropping the oldest. */
  test('leaks no WebGL context over twenty open and close cycles', async ({ page }) => {
    const OPENS = 20;
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('Too many active WebGL contexts')) warnings.push(message.text());
    });
    const errors = watchErrors(page);
    const report = await openPreview(page, previewUrl('zone', 0.5, OPENS));
    expect(report.opens).toBe(OPENS);
    expect(warnings, 'WebGL context warnings').toEqual([]);
    expect(errors, 'page and shader errors').toEqual([]);
  });
});
