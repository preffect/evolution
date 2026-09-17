// The renderer smoke (docs/TESTING.md, docs/rendering/files-and-tests.md §9): a live room from the lobby with a fixed
// seed, the canvas mounts, the baked dish field and the depth particles draw on SwiftShader without page
// errors, the canvas fills the viewport with no page scroll at the config's viewport and at the layout frame's minimum
// (docs/ui/layout.md §1, #217, #220), the debug hook's pause holds the rendered tick and a step advances it, and a
// screenshot lands under `.qa/screenshots/` for the PR. The bench route and its frame-budget report are
// `render-bench.spec.ts`.
import { expect, test, type Page } from '@playwright/test';
import {
  UI_REFERENCE_VIEWPORT_HEIGHT_PX,
  UI_REFERENCE_VIEWPORT_WIDTH_PX,
  UI_SCALE_MIN,
} from '../src/app/ui-kit/ui-kit-constants';
import { openLiveRoom, type DebugWindow } from './live-room';

/** The smallest viewport the layout frame targets (docs/ui/layout.md §1): the reference frame at the scale floor. */
const MINIMUM_VIEWPORT = {
  width: Math.round(UI_REFERENCE_VIEWPORT_WIDTH_PX * UI_SCALE_MIN),
  height: Math.round(UI_REFERENCE_VIEWPORT_HEIGHT_PX * UI_SCALE_MIN),
};

const SCREENSHOT_DIR = '../../.qa/screenshots';
const SMOKE_SEED = 42;
const GAME_NAME_PREFIX = 'render-smoke';
/** Long enough for the depth particles to drift a pixel between two stepped frames. */
const DRIFT_WAIT_MS = 1500;
const HOLD_WAIT_MS = 500;

/** This spec's room: the shared opener with this spec's name and seed. */
function openSmokeRoom(page: Page): Promise<string[]> {
  return openLiveRoom(page, GAME_NAME_PREFIX, SMOKE_SEED);
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

interface ViewportFit {
  readonly canvas: { readonly width: number; readonly height: number };
  readonly viewport: { readonly width: number; readonly height: number };
  readonly pageScrolls: boolean;
}

/** The canvas's CSS box against the viewport, and whether the document can scroll at all. */
function viewportFit(page: Page): Promise<ViewportFit> {
  return page.evaluate(() => {
    const box = document.querySelector('canvas[data-testid="game-canvas"]')?.getBoundingClientRect();
    const scroller = document.scrollingElement;
    return {
      canvas: { width: box?.width ?? 0, height: box?.height ?? 0 },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageScrolls:
        scroller !== null && (scroller.scrollHeight > window.innerHeight || scroller.scrollWidth > window.innerWidth),
    };
  });
}

/** The fill rule of docs/ui/layout.md §1: the canvas is exactly the viewport, nothing scrolls, no lobby panel is left. */
async function expectCanvasFillsViewport(page: Page): Promise<void> {
  const fit = await viewportFit(page);
  expect(fit.canvas).toEqual(fit.viewport);
  expect(fit.pageScrolls).toBe(false);
  expect(await page.locator('.panel').count()).toBe(0);
}

function renderTick(page: Page): Promise<number | null | undefined> {
  return page.evaluate(() => (window as DebugWindow).__evolutionDebug?.renderTick());
}

test.describe('renderer smoke on a live room', () => {
  test('draws the dish with the placeholder cell and screenshots it', async ({ page }) => {
    const errors = await openSmokeRoom(page);
    await page.waitForTimeout(DRIFT_WAIT_MS);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
    await page.waitForTimeout(HOLD_WAIT_MS);
    expect(errors, 'no page or shader errors').toEqual([]);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/render-smoke-live-seed${SMOKE_SEED}.png` });
  });

  test('the canvas fills the viewport and the page does not scroll (docs/ui/layout.md §1)', async ({ page }) => {
    await openSmokeRoom(page);
    await expectCanvasFillsViewport(page);
  });

  test('pause holds the rendered tick and the canvas; a step advances both', async ({ page }) => {
    await openSmokeRoom(page);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
    await page.waitForTimeout(HOLD_WAIT_MS);
    const heldTick = await renderTick(page);
    const heldHash = await canvasHash(page);
    await page.waitForTimeout(HOLD_WAIT_MS);
    expect(await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.isPaused())).toBe(true);
    expect(await renderTick(page)).toBe(heldTick);
    expect(await canvasHash(page)).toBe(heldHash);
    await page.waitForTimeout(DRIFT_WAIT_MS);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.step(1));
    await page.waitForTimeout(HOLD_WAIT_MS);
    expect(await renderTick(page)).toBeGreaterThan(heldTick ?? Number.POSITIVE_INFINITY);
    expect(await canvasHash(page)).not.toBe(heldHash);
  });
});

// Where HUD chrome (#189) is most likely to break the fill rule: the smallest viewport the layout frame targets.
test.describe('renderer smoke at the minimum viewport', () => {
  test.use({ viewport: MINIMUM_VIEWPORT });

  test(`the canvas fills the ${MINIMUM_VIEWPORT.width} × ${MINIMUM_VIEWPORT.height} viewport and the page does not scroll (docs/ui/layout.md §1)`, async ({
    page,
  }) => {
    await openSmokeRoom(page);
    expect(page.viewportSize()).toEqual(MINIMUM_VIEWPORT);
    await expectCanvasFillsViewport(page);
  });
});
