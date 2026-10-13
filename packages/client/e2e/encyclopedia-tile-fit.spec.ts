// Every landing tile reads in full (docs/ui/encyclopedia.md §11.3, #847), which only a real layout with the real font
// can answer: at each size §11.3 names, on every category's landing, no tile title is cut — not across its width, not
// past its line budget — no fact is cut past its own, and the caption stays inside its tile. The lobby's panel, so no
// room is needed. Run with `pnpm --filter @evolution/client smoke`; not part of `./validate.sh all`.

import { expect, test, type Page } from '@playwright/test';
import { ENCYCLOPEDIA_CATEGORY_ORDER, type EncyclopediaCategory } from '../src/app/game/encyclopedia/model/categories';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaCategoryTestId } from '../src/app/game/encyclopedia/test-ids';

/** The sizes §11.3 promises every tile reads in full at. */
const TILE_FIT_VIEWPORTS = [
  { width: 800, height: 600 },
  { width: 1024, height: 640 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;
/** Sub-pixel rounding between a box's scroll and client extents; a cut line is a whole line, far past this. */
const FIT_TOLERANCE_PX = 1;

interface TileFit {
  readonly title: string;
  readonly titleCut: boolean;
  readonly factCut: boolean;
  readonly captionOverflowPx: number;
}

/** Each tile on the open landing, measured: whether its title or fact is cut, and how far its caption overruns it. */
function measureTiles(page: Page): Promise<TileFit[]> {
  return page.evaluate((tolerance) => {
    const cut = (element: Element | null) =>
      element !== null &&
      (element.scrollWidth > element.clientWidth + tolerance ||
        element.scrollHeight > element.clientHeight + tolerance);
    return [...document.querySelectorAll('.tile')].map((tile) => {
      const title = tile.querySelector('.title');
      const lastLine = tile.querySelector('.fact') ?? title;
      return {
        title: title?.textContent ?? '',
        titleCut: cut(title),
        factCut: cut(tile.querySelector('.fact')),
        captionOverflowPx: (lastLine?.getBoundingClientRect().bottom ?? 0) - tile.getBoundingClientRect().bottom,
      };
    });
  }, FIT_TOLERANCE_PX);
}

async function openLanding(page: Page, category: EncyclopediaCategory): Promise<TileFit[]> {
  await page.getByTestId(encyclopediaCategoryTestId(category)).click();
  await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toHaveAttribute('data-location', `${category}|`);
  await expect(page.locator('.tile').first()).toBeVisible();
  return measureTiles(page);
}

for (const viewport of TILE_FIT_VIEWPORTS) {
  test(`every landing tile reads in full at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId(ENCYCLOPEDIA_TEST_ID.lobbyButton).click();
    await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeVisible();
    // Measured in Inter, not the fallback face it replaces once loaded.
    await page.evaluate(() => document.fonts.ready);

    for (const category of ENCYCLOPEDIA_CATEGORY_ORDER) {
      const tiles = await openLanding(page, category);
      expect(tiles.length, category).toBeGreaterThan(0);
      expect(
        tiles.filter((tile) => tile.titleCut).map((tile) => tile.title),
        `${category}: cut titles`,
      ).toEqual([]);
      expect(
        tiles.filter((tile) => tile.factCut).map((tile) => tile.title),
        `${category}: cut facts`,
      ).toEqual([]);
      expect(
        tiles.filter((tile) => tile.captionOverflowPx > FIT_TOLERANCE_PX).map((tile) => tile.title),
        `${category}: captions past the tile`,
      ).toEqual([]);
    }
  });
}
