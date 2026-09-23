// The hold-Tab "affecting you" panel on a live room (docs/ui/overlays.md §3.7, the U6 acceptance row of
// docs/ui/components-and-constants.md §8): holding Tab opens the full board and the panel together, the panel says
// what is acting on the cell, and letting Tab go takes both away again. Ids come from `HUD_TEST_ID`, so no id
// literal is typed twice.

import { expect, test } from '@playwright/test';
import { HUD_PLAYER_EXCLUSION_PX } from '../src/app/game/hud/hud-constants';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';
import { openLiveRoom } from './live-room';

const AFFECTING_SEED = 42;
const GAME_NAME_PREFIX = 'affecting';

test.describe('the hold-Tab affecting panel', () => {
  test('opens with the full board while Tab is held, and closes with it', async ({ page }) => {
    await openLiveRoom(page, GAME_NAME_PREFIX, AFFECTING_SEED);

    // Nothing of either is up until Tab is held (docs/ui/overlays.md §3.7).
    await expect(page.getByTestId(HUD_TEST_ID.affectingPanel)).toHaveCount(0);

    await page.keyboard.down('Tab');
    // The panel opens beside the full board, not instead of it: both are up at once.
    await expect(page.getByTestId(HUD_TEST_ID.affectingPanel)).toBeVisible();
    await expect(page.getByTestId(HUD_TEST_ID.leaderboardFull)).toBeVisible();
    // The two rows #387 names: the mass element and the standing against the world clock.
    await expect(page.getByTestId(HUD_TEST_ID.affectingMass)).toBeVisible();
    await expect(page.getByTestId(HUD_TEST_ID.affectingWorld)).toBeVisible();

    await page.keyboard.up('Tab');
    await expect(page.getByTestId(HUD_TEST_ID.affectingPanel)).toHaveCount(0);
    await expect(page.getByTestId(HUD_TEST_ID.leaderboardFull)).toHaveCount(0);
  });

  test('is a region that holds nothing focusable, since Tab is being held to see it', async ({ page }) => {
    await openLiveRoom(page, GAME_NAME_PREFIX, AFFECTING_SEED);
    await page.keyboard.down('Tab');

    const panel = page.getByTestId(HUD_TEST_ID.affectingPanel);
    await expect(panel).toHaveAttribute('role', 'region');
    await expect(panel).toHaveAttribute('aria-label', /affecting/i);
    // A focus trap or a Tab stop inside would fight the very key holding the panel open.
    expect(await panel.locator('button, a[href], input, select, textarea, [tabindex]').count()).toBe(0);

    await page.keyboard.up('Tab');
  });

  test('leaves the player clear of the panel: it stays out of the exclusion box', async ({ page }) => {
    await openLiveRoom(page, GAME_NAME_PREFIX, AFFECTING_SEED);
    await page.keyboard.down('Tab');

    const box = await page.getByTestId(HUD_TEST_ID.affectingPanel).boundingBox();
    expect(box).not.toBeNull();

    // docs/ui/layout.md §1: no DOM element enters the central square around the player's own cell. The square is
    // `HUD_PLAYER_EXCLUSION_PX` each way from the viewport centre, scaled by the HUD's own scale — 520 to 760 at
    // the 1280 reference viewport. Asserting only "left of the midpoint" would pass a panel 144 px too wide.
    const scale = await page.evaluate(
      (hudTestId) =>
        Number(
          getComputedStyle(document.querySelector(`[data-testid="${hudTestId}"]`)!).getPropertyValue('--ui-scale'),
        ),
      HUD_TEST_ID.hud,
    );
    const viewport = page.viewportSize()!;
    const half = HUD_PLAYER_EXCLUSION_PX * scale;
    const square = {
      left: viewport.width / 2 - half,
      right: viewport.width / 2 + half,
      top: viewport.height / 2 - half,
      bottom: viewport.height / 2 + half,
    };
    const overlaps =
      box!.x < square.right &&
      box!.x + box!.width > square.left &&
      box!.y < square.bottom &&
      box!.y + box!.height > square.top;
    expect(overlaps).toBe(false);

    await page.keyboard.up('Tab');
  });
});
