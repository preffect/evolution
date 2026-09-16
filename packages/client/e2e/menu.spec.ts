// The Escape menu in a live room (docs/ui/components-and-constants.md §8, U6's menu step and U12): headless Chromium
// against the dev servers, like `render-smoke.spec.ts`. Run with `pnpm --filter @evolution/client smoke`; not part
// of `./validate.sh all`. U8–U11 need the encyclopedia shell (#372) and join this file with it.
import { expect, test, type Page } from '@playwright/test';
import { HUD_TEST_ID } from '../src/app/game/hud/test-ids';

const MENU_SEED = 42;
const GAME_NAME_PREFIX = 'menu';
/** Enough of the test id to tell rooms apart while staying under `GAME_NAME_MAX_LENGTH`. */
const GAME_NAME_SUFFIX_LENGTH = 8;

/** Creates and starts a fresh room named after the test, and puts focus on the canvas host. */
async function openLiveRoom(page: Page): Promise<void> {
  const gameName = `${GAME_NAME_PREFIX}-${test.info().testId.slice(-GAME_NAME_SUFFIX_LENGTH)}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect & Join Lobby' }).click();
  await expect(page.locator('.conn')).toHaveText(/connected/);
  await page.getByLabel('Game name').fill(gameName);
  await page.getByTestId('create-seed').fill(String(MENU_SEED));
  await page.getByRole('button', { name: 'Create' }).click();
  const row = page
    .locator('.games li', { hasText: gameName })
    .filter({ hasNot: page.locator('.badge') })
    .first();
  await row.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId(HUD_TEST_ID.hud)).toBeVisible();
  await page.getByTestId(HUD_TEST_ID.gameHost).focus();
}

test.describe('the Escape menu on a live room', () => {
  test('U6: Escape opens the menu with focus on Return to game, and closes it again', async ({ page }) => {
    await openLiveRoom(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(HUD_TEST_ID.menuOverlay)).toBeVisible();
    await expect(page.getByTestId(HUD_TEST_ID.menuResume)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(HUD_TEST_ID.menuOverlay)).toHaveCount(0);
    await expect(page.getByTestId(HUD_TEST_ID.gameHost)).toBeFocused();
  });

  test('U12: Exit game asks once, Escape restores it, and Exit leaves for the lobby', async ({ page }) => {
    await openLiveRoom(page);
    await page.keyboard.press('Escape');
    await page.getByTestId(HUD_TEST_ID.menuExit).click();
    await expect(page.getByTestId(HUD_TEST_ID.menuExitCancel)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(HUD_TEST_ID.menuExit)).toBeFocused();
    await expect(page.getByTestId(HUD_TEST_ID.menuOverlay)).toBeVisible();
    await page.getByTestId(HUD_TEST_ID.menuExit).click();
    await page.getByTestId(HUD_TEST_ID.menuExitConfirm).click();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });
});
