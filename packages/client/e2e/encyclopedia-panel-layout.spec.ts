// The encyclopedia panel's frame (docs/ui/encyclopedia.md §11.3, #461), which only a real layout can answer: on the
// kit's bleed body the panel keeps its reference box, the rail sits flush with the panel's inner edge, and the three
// columns fill the body below the header rather than covering it.

import { expect, test } from '@playwright/test';
import { ENCYCLOPEDIA_TEST_ID } from '../src/app/game/encyclopedia/test-ids';

const REFERENCE_VIEWPORT = { width: 1280, height: 800 };
/** §11.3's worked example at 1280 × 800: 1216 × 736 at (32, 32). */
const PANEL_BOX = { x: 32, y: 32, width: 1216, height: 736 };
/** The panel's rim: the rail starts just inside it. */
const RIM_PX = 1;
const LAYOUT_TOLERANCE_PX = 1;

test('the panel keeps its reference box and the rail sits flush on the bleed body', async ({ page }) => {
  await page.setViewportSize(REFERENCE_VIEWPORT);
  await page.goto('/');
  await page.getByTestId(ENCYCLOPEDIA_TEST_ID.lobbyButton).click();
  const panel = page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia);
  await expect(panel).toBeVisible();
  // The modal rises into place over `UI_PANEL_ENTER_MS`; measure where it settles.
  await panel.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  const boxes = await panel.evaluate((element) => {
    const rect = (target: Element | null) => {
      const box = target?.getBoundingClientRect();
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom } : null;
    };
    return {
      panel: rect(element),
      header: rect(element.querySelector('.header')),
      columns: rect(element.querySelector('.columns')),
      rail: rect(element.querySelector('app-encyclopedia-rail')),
    };
  });
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs((boxes.panel?.[key] ?? 0) - PANEL_BOX[key])).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
  }
  expect(Math.abs((boxes.rail?.x ?? 0) - (PANEL_BOX.x + RIM_PX))).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
  expect((boxes.columns?.y ?? 0) + LAYOUT_TOLERANCE_PX).toBeGreaterThanOrEqual(boxes.header?.bottom ?? 0);
  expect(boxes.columns?.bottom ?? 0).toBeLessThanOrEqual((boxes.panel?.bottom ?? 0) + LAYOUT_TOLERANCE_PX);
});
