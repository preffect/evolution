// The renderer smoke (docs/TESTING.md, docs/RENDERING.md §9): a live room from the lobby with a fixed
// seed, the canvas mounts, the shader-free slice A scene draws on SwiftShader without page errors,
// the canvas fills the viewport with no page scroll (docs/UI.md §1, #217), the debug hook's pause holds
// the rendered tick and a step advances it, and a screenshot lands under `.qa/screenshots/` for the PR.
// Slice D (#208) adds the bench route and the frame-budget report.
import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = '../../.qa/screenshots';
const SMOKE_SEED = 42;
const GAME_NAME_PREFIX = 'render-smoke';
/** Enough of the test id to tell rooms apart while staying under `GAME_NAME_MAX_LENGTH`. */
const GAME_NAME_SUFFIX_LENGTH = 8;
/** `AUDIO_ASSET_BASE_PATH`: the audio assets are opt-in (docs/AUDIO-PIPELINE.md); a missing one is a silent cue, not a renderer error. */
const AUDIO_ASSET_PATH = '/assets/audio/';
/** Long enough for the depth particles to drift a pixel between two stepped frames. */
const DRIFT_WAIT_MS = 1500;
const HOLD_WAIT_MS = 500;

interface DebugWindow {
  __evolutionDebug?: {
    pause(): void;
    step(frames?: number): void;
    renderTick(): number | null;
    isPaused(): boolean;
  };
}

/** Creates and starts a fresh room named after the test, so reruns never pick an already-started one. */
async function openLiveRoom(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const isMissingAudioAsset = message.location().url.includes(AUDIO_ASSET_PATH);
    if (message.type() === 'error' && !isMissingAudioAsset)
      errors.push(`${message.text()} (${message.location().url})`);
  });
  const gameName = `${GAME_NAME_PREFIX}-${test.info().testId.slice(-GAME_NAME_SUFFIX_LENGTH)}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect & Join Lobby' }).click();
  await expect(page.locator('.conn')).toHaveText(/connected/);
  await page.getByLabel('Game name').fill(gameName);
  await page.getByTestId('create-seed').fill(String(SMOKE_SEED));
  await page.getByRole('button', { name: 'Create' }).click();
  const row = page
    .locator('.games li', { hasText: gameName })
    .filter({ hasNot: page.locator('.badge') })
    .first();
  await row.getByRole('button', { name: 'Start' }).click();
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

function renderTick(page: Page): Promise<number | null | undefined> {
  return page.evaluate(() => (window as DebugWindow).__evolutionDebug?.renderTick());
}

test.describe('renderer smoke on a live room', () => {
  test('draws the dish with the placeholder cell and screenshots it', async ({ page }) => {
    const errors = await openLiveRoom(page);
    await page.waitForTimeout(DRIFT_WAIT_MS);
    await page.evaluate(() => (window as DebugWindow).__evolutionDebug?.pause());
    await page.waitForTimeout(HOLD_WAIT_MS);
    expect(errors, 'no page or shader errors').toEqual([]);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/pr205-live-seed${SMOKE_SEED}.png` });
  });

  test('the canvas fills the viewport and the page does not scroll (docs/UI.md §1)', async ({ page }) => {
    await openLiveRoom(page);
    const fit = await viewportFit(page);
    expect(fit.canvas).toEqual(fit.viewport);
    expect(fit.pageScrolls).toBe(false);
    expect(await page.locator('.panel').count()).toBe(0);
  });

  test('pause holds the rendered tick and the canvas; a step advances both', async ({ page }) => {
    await openLiveRoom(page);
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
