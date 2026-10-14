// Every entry page's facts read in full (docs/ui/encyclopedia.md §11.4, #854), which only a real layout with the real
// font can answer: at each size §11.3 names, on every entry of every category, every fact name, value and tier
// heading sits inside the detail column — the panel's right edge is the column's — rather than running out past it,
// as the giants' facts did at 800 × 600 beside the lens; every facts table is no wider than the column it sits in,
// beside the lens or stacked under it; and every value that is a figure holds one line, never breaking between a
// number and its unit (#858). The lobby's panel, so no room is needed. Run with
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
/** A fact link's test id is this plus the entry id (`encyclopediaLinkTestId`). */
const LINK_TEST_ID_PREFIX = 'encyclopedia-link-';
/** Two text boxes whose bottoms are further apart than this are on different lines; one line's boxes share a bottom. */
const SAME_LINE_TOLERANCE_PX = 1;

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

/**
 * Every facts table on the open entry page wider than the column holding it, as `<first row name>: <table> > <column>`
 * px (#858). The cut check above only sees a table once it crosses the panel's edge; this one sees the tier table
 * outgrow the title column beside the lens, which is what an unbreakable `+0.3 mass / s` in three columns did.
 */
function wideFactTables(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ factsTestId, tolerance }) =>
      [...document.querySelectorAll(`[data-testid="${factsTestId}"]`)].flatMap((table) => {
        const tableWidth = table.getBoundingClientRect().width;
        const columnWidth = table.parentElement?.getBoundingClientRect().width ?? 0;
        if (tableWidth <= columnWidth + tolerance) return [];
        const firstName = table.querySelector('tbody th')?.textContent?.trim() ?? '';
        return [`${firstName}: ${Math.round(tableWidth)} > ${Math.round(columnWidth)}`];
      }),
    { factsTestId: ENCYCLOPEDIA_TEST_ID.facts, tolerance: FIT_TOLERANCE_PX },
  );
}

/**
 * The text of every figure value on the open entry page that runs over more than one line (#858). A value that is not
 * a list of links is one `formatQuantity` result — one number and its unit — or, in the tier table, a bare figure
 * whose unit is in its row's name; either way a second line can only be a break inside the pair: `+0.3 mass` over
 * `/ s`, `5000` over `mass`. A list of links may wrap between its titles, and a title is no number, so those cells are
 * left out. Lines are told apart by the bottoms of the cell's text boxes.
 */
function brokenFactValues(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ factsTestId, linkTestIdPrefix, tolerance }) => {
      const lineCountOf = (cell: Element): number => {
        const bottoms: number[] = [];
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const box of range.getClientRects()) {
            const isNewLine = box.width > 0 && bottoms.every((bottom) => Math.abs(bottom - box.bottom) > tolerance);
            if (isNewLine) bottoms.push(box.bottom);
          }
        }
        return bottoms.length;
      };
      return [...document.querySelectorAll(`[data-testid="${factsTestId}"] td`)]
        .filter((cell) => cell.querySelector(`[data-testid^="${linkTestIdPrefix}"]`) === null && lineCountOf(cell) > 1)
        .map((cell) => cell.textContent?.trim() ?? '');
    },
    {
      factsTestId: ENCYCLOPEDIA_TEST_ID.facts,
      linkTestIdPrefix: LINK_TEST_ID_PREFIX,
      tolerance: SAME_LINE_TOLERANCE_PX,
    },
  );
}

/**
 * What one walk found wrong, each `<entry>: <what>`: the cells past the detail column, the tables wider than their
 * column and the figures broken over lines.
 */
interface FactFaults {
  readonly cut: string[];
  readonly wide: string[];
  readonly broken: string[];
}

/** Opens each entry of the category's list in turn and adds its cut cells, wide tables and broken values to `faults`. */
async function collectFactFaults(page: Page, rowTestIds: readonly string[], faults: FactFaults): Promise<void> {
  for (const rowTestId of rowTestIds) {
    const entryId = rowTestId.slice(ROW_TEST_ID_PREFIX.length);
    await page.getByTestId(rowTestId).click();
    await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.entry)).toHaveAttribute('data-entry-id', entryId);
    faults.cut.push(...(await cutFactCells(page)).map((cell) => `${entryId}: ${cell}`));
    faults.wide.push(...(await wideFactTables(page)).map((table) => `${entryId}: ${table}`));
    faults.broken.push(...(await brokenFactValues(page)).map((cell) => `${entryId}: ${cell}`));
  }
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
    const faults: FactFaults = { cut: [], wide: [], broken: [] };
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
      await collectFactFaults(page, rowTestIds, faults);
    }
    expect(entryCount).toBeGreaterThan(0);
    // Soft, so one run names every kind of fault rather than stopping at the first.
    expect.soft(faults.cut, 'facts past the detail column').toEqual([]);
    expect.soft(faults.wide, 'facts tables wider than their column').toEqual([]);
    expect.soft(faults.broken, 'values broken between a number and its unit').toEqual([]);
  });
}
