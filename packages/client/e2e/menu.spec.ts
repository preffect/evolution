// The Escape menu in a live room (docs/ui/components-and-constants.md §8, U6's menu step and U12): headless Chromium
// against the dev servers, like `render-smoke.spec.ts`. Run with `pnpm --filter @evolution/client smoke`; not part
// of `./validate.sh all`. U8–U11 need the encyclopedia shell (#372) and join this file with it.
import { expect, test, type Page } from '@playwright/test';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';
import { callDebugTool, ownRoom } from './debug-mcp';

const MENU_SEED = 42;
const GAME_NAME_PREFIX = 'menu';
/** A phone held landscape: the shortest viewport the menu is drawn for (docs/ui/overlays.md §3.5). */
const PHONE_LANDSCAPE = { width: 844, height: 390 };
/** A level that owns six traits, and the most common list and a list long enough to scroll. */
const TRAIT_LEVEL = 6;
const THREE_TRAITS = ['nucleoid', 'simple_flagellum', 'mitochondrion'];
const SIX_TRAITS = [...THREE_TRAITS, 'ribosomes', 'cilia', 'toxin_vacuole'];
/** How much a box may sit past its clip for rounding: a fraction of one CSS pixel. */
const LAYOUT_EPSILON_PX = 0.5;

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

  for (const traits of [THREE_TRAITS, SIX_TRAITS]) {
    test(`on a phone held landscape, Exit game stays in view over ${traits.length} traits, which scroll instead`, async ({
      page,
    }) => {
      await openLiveRoom(page);
      const { gameId, playerId } = await ownRoom(page);
      await callDebugTool(page, 'debug_set_player', { gameId, playerId, level: TRAIT_LEVEL, traits });
      await page.setViewportSize(PHONE_LANDSCAPE);
      await page.getByTestId(HUD_TEST_ID.gameHost).focus();
      await page.keyboard.press('Escape');
      const rows = page.getByTestId(HUD_TEST_ID.menuTraits).locator('ui-list-row');
      await expect(rows).toHaveCount(traits.length);

      const body = page.getByTestId(HUD_TEST_ID.menuOverlay).locator('ui-scroll-area.body .viewport');
      const bodyBox = (await body.boundingBox())!;
      const exitBox = (await page.getByTestId(HUD_TEST_ID.menuExit).boundingBox())!;
      expect(exitBox.y + exitBox.height).toBeLessThanOrEqual(bodyBox.y + bodyBox.height + LAYOUT_EPSILON_PX);
      expect(await body.evaluate((viewport) => viewport.scrollHeight - viewport.clientHeight)).toBeLessThanOrEqual(0);
      // The list gave up the height instead: at least its first row still shows, and a long list scrolls.
      const list = page.getByTestId(HUD_TEST_ID.menuOverlay).locator('app-menu-traits ui-scroll-area .viewport');
      const listBox = (await list.boundingBox())!;
      const firstRow = (await rows.first().boundingBox())!;
      expect(firstRow.y + firstRow.height).toBeLessThanOrEqual(listBox.y + listBox.height + LAYOUT_EPSILON_PX);
      if (traits === SIX_TRAITS) {
        expect(await list.evaluate((viewport) => viewport.scrollHeight - viewport.clientHeight)).toBeGreaterThan(0);
      }
    });
  }
});
