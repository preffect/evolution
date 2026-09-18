// U9 of docs/ui/components-and-constants.md §8, on a live room: headless Chromium against the dev servers, like
// `menu.spec.ts`. Run with `pnpm --filter @evolution/client smoke`; not part of `./validate.sh all`.
//
// **One of U9's assertions is not run here, and it is not a shortcut.**
//
//   * `activate the first encyclopedia-link-bacterium:aerobic` — **no such link can exist yet.** The registry holds
//     the stages, the traits and the DNA tags; the `bacterium:` subject arrives with the entities category (#361),
//     and until it does, neither the prose nor the facts of any entry can name one. The step below follows the
//     equivalent link that does exist — the summary's `[[stage:endosymbiosis]]` — so the push-and-Back half of U9
//     is exercised in full, on a different target. When #361 lands, this line becomes U9 as written.
//
// U10 is not here at all: every one of its assertions is on `encyclopedia-alert`, the strip the *host* projects into
// the header (#448's seam, §11.1), and its steps need `debug_grant_dna` and `debug_spawn` — a debug driver this e2e
// harness does not have. It exercises nothing the entry page owns.

import { expect, test, type Page } from '@playwright/test';
import {
  ENCYCLOPEDIA_TEST_ID,
  encyclopediaCategoryTestId,
  encyclopediaLinkTestId,
  encyclopediaRowTestId,
} from '../src/app/game/encyclopedia/test-ids';
import type { EntryId } from '../src/app/game/encyclopedia/model/entry-id';
import { openRoom } from './live-room';

const ENCYCLOPEDIA_SEED = 42;
/**
 * The lens once its first frame is drawn (docs/ui/encyclopedia.md §11.4). Written out rather than imported from
 * `ENCYCLOPEDIA_PREVIEW_STATE`: that constant sits beside the preview seam, whose module graph reaches
 * `createPixiApp` and so all of Pixi, and this file runs in Playwright's own Node process. The value is part of the
 * §11.6 DOM contract, and `encyclopedia-lens.component.spec.ts` holds the element to the constant.
 */
const PREVIEW_STATE_LIVE = 'live';
/**
 * How long the lens is given to open. It is not the budget — `PREVIEW_OPEN_BUDGET_MS` is 300 and is judged on real
 * hardware through the evidence route (architecture/encyclopedia.md §12.7) — it is a smoke's patience with the
 * container's SwiftShader, which rasterises the whole bake on the CPU.
 */
const PREVIEW_OPEN_TIMEOUT_MS = 30_000;
const GAME_NAME_PREFIX = 'pedia';
const MITOCHONDRION = 'trait:mitochondrion' as EntryId;
const ENDOSYMBIOSIS = 'stage:endosymbiosis' as EntryId;
const NUCLEOID = 'trait:nucleoid' as EntryId;

function openEntry(page: Page): ReturnType<Page['getByTestId']> {
  return page.getByTestId(ENCYCLOPEDIA_TEST_ID.entry);
}

test.describe('U9: the encyclopedia over a live room', () => {
  test('opens on H, searches, follows a link and comes back', async ({ page }) => {
    // The HUD, not the first rendered frame: nothing U9 touches is drawn by the renderer.
    await openRoom(page, GAME_NAME_PREFIX, ENCYCLOPEDIA_SEED);

    await page.keyboard.press('h');
    await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeVisible();

    await page.getByTestId(encyclopediaCategoryTestId('evolutions')).click();
    await expect(page.getByTestId(encyclopediaRowTestId(NUCLEOID))).toBeVisible();

    await page.keyboard.press('/');
    await page.getByTestId(ENCYCLOPEDIA_TEST_ID.search).fill('mito');
    await page.getByTestId(ENCYCLOPEDIA_TEST_ID.search).press('Enter');
    await expect(openEntry(page)).toHaveAttribute('data-entry-id', MITOCHONDRION);

    // The content the human reported missing: the page is not a title and a breadcrumb any more.
    await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.facts).first()).toBeVisible();

    // U9's lens (#466). The state is what makes the assertion worth anything: an element with the id and no
    // `data-preview-state` would say only that something is drawn there, and `live` is a frame that was rendered by
    // the real `GameRenderer` on this page's own WebGL context.
    const lens = openEntry(page).getByTestId(ENCYCLOPEDIA_TEST_ID.preview);
    await expect(lens).toBeVisible();
    await expect(lens).toHaveAttribute('data-preview-state', PREVIEW_STATE_LIVE, { timeout: PREVIEW_OPEN_TIMEOUT_MS });
    await expect(openEntry(page).locator('ui-chip').first()).toBeVisible();
    await expect(openEntry(page).locator('app-encyclopedia-prose')).toBeVisible();

    // `.first()` is U9's own "the first ... link": on this page that is the facts table's `Climbs to`, since the
    // table sits above the prose. Which region a link lives in is pinned per region in
    // `encyclopedia-entry.integration.spec.ts`, where a whole-page query hid a broken transition once already.
    await openEntry(page).getByTestId(encyclopediaLinkTestId(ENDOSYMBIOSIS)).first().click();
    await expect(openEntry(page)).toHaveAttribute('data-entry-id', ENDOSYMBIOSIS);

    await page.getByTestId(ENCYCLOPEDIA_TEST_ID.back).click();
    await expect(openEntry(page)).toHaveAttribute('data-entry-id', MITOCHONDRION);
  });
});
