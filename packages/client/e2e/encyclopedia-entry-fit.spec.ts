// Every entry page's facts read in full (docs/ui/encyclopedia.md §11.4, #854), which only a real layout with the real
// font can answer: at each size §11.3 names, on every entry of every category, every fact name, value and tier
// heading sits inside the detail column — the panel's right edge is the column's — rather than running out past it,
// as the giants' facts did at 800 × 600 beside the lens. The lobby's panel, so no room is needed. Run with
// `pnpm --filter @evolution/client smoke`; not part of `./validate.sh all`.

import { expect, test, type Page } from '@playwright/test';
import { ENCYCLOPEDIA_CATEGORY_ORDER } from '../src/app/game/encyclopedia/model/categories';
import { ENCYCLOPEDIA_TEST_ID, encyclopediaCategoryTestId } from '../src/app/game/encyclopedia/test-ids';

/** The sizes §11.3 promises the panel reads at, the same four the landing tiles are held to. */
const ENTRY_FIT_VIEWPORTS = [
  { width: 800, height: 600 },
  { width: 1024, height: 640 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;
/** Sub-pixel rounding between two boxes' edges; a cut fact is a word or more past the edge, far past this. */
const FIT_TOLERANCE_PX = 1;
/**
 * One test opens every entry at its size, each starting its lens's preview in software WebGL: about 40 s on a quiet
 * box, and several times that while a validation run shares it, which the default two minutes did not cover.
 */
const ENTRY_WALK_TIMEOUT_MS = 300_000;
/** A list row's test id is this plus the entry id (`encyclopediaRowTestId`). */
const ROW_TEST_ID_PREFIX = 'encyclopedia-row-';

/** The text of every facts-table cell on the open entry page that crosses the detail column's left or right edge. */
function cutFactCells(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ entryTestId, factsTestId, tolerance }) => {
      const column = document.querySelector(`[data-testid="${entryTestId}"]`)?.getBoundingClientRect();
      if (column === undefined) return ['(no entry page)'];
      const cells = document.querySelectorAll(`[data-testid="${factsTestId}"] th, [data-testid="${factsTestId}"] td`);
      return [...cells]
        .filter((cell) => {
          const box = cell.getBoundingClientRect();
          return box.left < column.left - tolerance || box.right > column.right + tolerance;
        })
        .map((cell) => cell.textContent?.trim() ?? '');
    },
    { entryTestId: ENCYCLOPEDIA_TEST_ID.entry, factsTestId: ENCYCLOPEDIA_TEST_ID.facts, tolerance: FIT_TOLERANCE_PX },
  );
}

/** Opens each entry of the category's list in turn and names the cut cells of each, `<entry>: <cell>`. */
async function cutFactsIn(page: Page, rowTestIds: readonly string[]): Promise<string[]> {
  const cut: string[] = [];
  for (const rowTestId of rowTestIds) {
    const entryId = rowTestId.slice(ROW_TEST_ID_PREFIX.length);
    await page.getByTestId(rowTestId).click();
    await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.entry)).toHaveAttribute('data-entry-id', entryId);
    cut.push(...(await cutFactCells(page)).map((cell) => `${entryId}: ${cell}`));
  }
  return cut;
}

for (const viewport of ENTRY_FIT_VIEWPORTS) {
  test(`every entry's facts read in full at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    test.setTimeout(ENTRY_WALK_TIMEOUT_MS);
    // A paused lens draws one frame and stops (§11.4), so the walk is not paying for every scene's animation.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByTestId(ENCYCLOPEDIA_TEST_ID.lobbyButton).click();
    await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeVisible();
    // Measured in Inter, not the fallback face it replaces once loaded.
    await page.evaluate(() => document.fonts.ready);

    let entryCount = 0;
    const cut: string[] = [];
    for (const category of ENCYCLOPEDIA_CATEGORY_ORDER) {
      await page.getByTestId(encyclopediaCategoryTestId(category)).click();
      // The category's own landing, so the rows read next are its list and not the one before.
      await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toHaveAttribute(
        'data-location',
        `${category}|`,
      );
      const rows = page.getByTestId(ENCYCLOPEDIA_TEST_ID.list).locator(`[data-testid^="${ROW_TEST_ID_PREFIX}"]`);
      await expect(rows.first()).toBeVisible();
      const rowTestIds = await rows.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-testid') ?? ''),
      );
      entryCount += rowTestIds.length;
      cut.push(...(await cutFactsIn(page, rowTestIds)));
    }
    expect(entryCount).toBeGreaterThan(0);
    expect(cut, 'facts past the detail column').toEqual([]);
  });
}
