// The lobby with the opening dive (docs/ui/layout.md §2.1, ticket #805): Connect is never below the fold, and the dive
// is in view without scrolling — beside the forms from 1024 px wide, and right under Connection on a phone. Headless
// Chromium against the dev servers, like `render-smoke.spec.ts`. Run with `pnpm --filter @evolution/client smoke`;
// not part of `./validate.sh all`.
import { expect, test, type Locator } from '@playwright/test';
import { DIVE_PANEL_TEST_ID } from '../src/app/game/test-ids/dive-test-ids';

/** The reference screen, the smallest the two columns are drawn for, and a phone held upright. */
const DESKTOP = { width: 1280, height: 800 };
const SMALL_DESKTOP = { width: 1024, height: 640 };
const PHONE = { width: 390, height: 844 };
/** A window wider than the layout's widest column, to resize down from. */
const WIDE_DESKTOP = { width: 1920, height: 1080 };
/** How much a box may sit past the fold for rounding: a fraction of one CSS pixel. */
const LAYOUT_EPSILON_PX = 0.5;
/** On the 1024 stage the readout takes at most this share of its width, so the planet's names stay by their dots. */
const NARROW_STAGE_READOUT_SHARE = 0.6;
/** How long the canvases have to follow a resize: a few frames. */
const RESIZE_SETTLE_MS = 1000;

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

for (const viewport of [DESKTOP, SMALL_DESKTOP]) {
  test(`at ${viewport.width}×${viewport.height} the dive sits beside Connect, both whole above the fold`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const connect = await boxOf(page.getByRole('button', { name: 'Connect & Join Lobby' }));
    const panel = await boxOf(page.getByTestId(DIVE_PANEL_TEST_ID.panel));
    expect(connect.y + connect.height).toBeLessThanOrEqual(viewport.height + LAYOUT_EPSILON_PX);
    expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height + LAYOUT_EPSILON_PX);
    // Side by side: the dive's column starts right of Connect's.
    expect(panel.x).toBeGreaterThanOrEqual(connect.x + connect.width);
    expect(await page.locator('.lobby').evaluate((lobby) => lobby.scrollWidth <= lobby.clientWidth)).toBe(true);
  });
}

test('on a phone Connect comes first, then the dive’s whole stage, above the fold', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/');
  const connect = await boxOf(page.getByRole('button', { name: 'Connect & Join Lobby' }));
  const stage = await boxOf(page.getByTestId(DIVE_PANEL_TEST_ID.stage));
  expect(stage.y).toBeGreaterThanOrEqual(connect.y + connect.height);
  expect(stage.y + stage.height).toBeLessThanOrEqual(PHONE.height + LAYOUT_EPSILON_PX);
  expect(await page.locator('.lobby').evaluate((lobby) => lobby.scrollWidth <= lobby.clientWidth)).toBe(true);
});

test('at 1024×640 the readout takes at most 60% of the narrow stage', async ({ page }) => {
  await page.setViewportSize(SMALL_DESKTOP);
  await page.goto('/');
  const stage = await boxOf(page.getByTestId(DIVE_PANEL_TEST_ID.stage));
  const readout = await boxOf(page.getByTestId(DIVE_PANEL_TEST_ID.readoutFieldOfView).locator('..'));
  expect(readout.width).toBeLessThanOrEqual(stage.width * NARROW_STAGE_READOUT_SHARE + LAYOUT_EPSILON_PX);
});

test('the dive’s canvases follow its stage when the window shrinks from 1920 to 1024', async ({ page }) => {
  await page.setViewportSize(WIDE_DESKTOP);
  await page.goto('/');
  await expect(page.getByTestId(DIVE_PANEL_TEST_ID.stage).locator('canvas')).toHaveCount(2);
  await page.setViewportSize(SMALL_DESKTOP);
  await page.waitForTimeout(RESIZE_SETTLE_MS);
  const stage = await boxOf(page.getByTestId(DIVE_PANEL_TEST_ID.stage));
  for (const canvas of await page.getByTestId(DIVE_PANEL_TEST_ID.stage).locator('canvas').all()) {
    const box = await boxOf(canvas);
    expect(Math.abs(box.width - stage.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.height - stage.height)).toBeLessThanOrEqual(1);
  }
});
