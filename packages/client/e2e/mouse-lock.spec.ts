// The mouse lock in a live room (docs/ui/input-and-onboarding.md §4.1, #794): headless Chromium against the dev
// servers, like `menu.spec.ts`. Headless Chromium cannot be relied on to grant a real pointer lock, so the page's
// Pointer Lock API is replaced before the app loads: `requestPointerLock` locks at once, `exitPointerLock` lets go,
// and `__escapeOutOfLock()` drops the lock as the browser does on Escape. A locked pointer's events all go to the
// canvas host, so the locked moves and clicks are dispatched there with their `movementX/Y`. Screenshots of the
// in-game cursor, the menu after an Escape and a card under the locked pointer land in `.qa/screenshots/`.
// Run with `pnpm --filter @evolution/client smoke`; not part of `./validate.sh all`.
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BALANCE, FIRST_LEVEL, levelUpCost } from '@evolution/shared';
import { POINTER_LOCK_RETRY_COOLDOWN_MS } from '../src/app/game/input/input-constants';
import { HUD_TEST_ID, traitCardPickTestId } from '../src/app/game/test-ids/hud-test-ids';
import { callDebugTool, ownRoom } from './debug-mcp';
import { openLiveRoom } from './live-room';

const SEED = 794;
const SCREENSHOT_DIR = '../../.qa/screenshots';
/** A 32:9 screen: wider than `INTEREST_VIEW_ASPECT_RATIO`, so the dish field fills the sides (§4.1's play area). */
const ULTRAWIDE = { width: 3840, height: 1080 };
const LEVEL_UP_DNA = levelUpCost(FIRST_LEVEL, DEFAULT_BALANCE.progression);

interface LockWindow {
  __pointerLockRequests: number;
  __escapeOutOfLock(): void;
}

/** Replaces the Pointer Lock API before the app's scripts run. */
async function stubPointerLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const lockWindow = window as unknown as LockWindow;
    let locked: Element | null = null;
    const setLocked = (next: Element | null): void => {
      locked = next;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    lockWindow.__pointerLockRequests = 0;
    lockWindow.__escapeOutOfLock = () => setLocked(null);
    Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => locked });
    Element.prototype.requestPointerLock = function requestPointerLock(this: Element): Promise<void> {
      lockWindow.__pointerLockRequests += 1;
      setTimeout(() => setLocked(this));
      return Promise.resolve();
    };
    Document.prototype.exitPointerLock = function exitPointerLock(): void {
      if (locked !== null) setTimeout(() => setLocked(null));
    };
  });
}

async function lockRequests(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as LockWindow).__pointerLockRequests);
}

/** A locked move or press: dispatched on the canvas host, where the browser sends every locked pointer event. */
async function dispatchOnHost(page: Page, type: string, movement = { x: 0, y: 0 }): Promise<void> {
  await page.getByTestId(HUD_TEST_ID.gameHost).evaluate(
    (host, [eventType, movementX, movementY]) =>
      host.dispatchEvent(
        new PointerEvent(eventType as string, {
          bubbles: true,
          pointerType: 'mouse',
          button: 0,
          movementX: movementX as number,
          movementY: movementY as number,
        }),
      ),
    [type, movement.x, movement.y] as const,
  );
}

/**
 * A screenshot with the panels' entry animations finished: under SwiftShader a frame takes seconds, and the kit
 * panel's fade-in would otherwise still be at its first, transparent frame.
 */
async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, animations: 'disabled' });
}

/** The cursor's centre, which is the virtual pointer. */
async function cursorCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.getByTestId(HUD_TEST_ID.virtualCursor).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function lockAtCentre(page: Page): Promise<{ x: number; y: number }> {
  const viewport = page.viewportSize()!;
  const centre = { x: viewport.width / 2, y: viewport.height / 2 };
  await page.mouse.click(centre.x, centre.y);
  await expect(page.getByTestId(HUD_TEST_ID.virtualCursor)).toBeVisible();
  return centre;
}

test.describe('the mouse lock on a live room', () => {
  test.beforeEach(async ({ page }) => {
    await stubPointerLock(page);
  });

  test('locks on the first click, draws the cursor, and an Escape out of the lock opens the menu', async ({ page }) => {
    await openLiveRoom(page, 'lock', SEED);
    const centre = await lockAtCentre(page);
    expect(await lockRequests(page)).toBe(1);
    expect(await cursorCentre(page)).toEqual(centre);

    await dispatchOnHost(page, 'pointermove', { x: 220, y: -140 });
    expect(await cursorCentre(page)).toEqual({ x: centre.x + 220, y: centre.y - 140 });
    await screenshot(page, 'mouse-lock-cursor-1920');

    await page.evaluate(() => (window as unknown as LockWindow).__escapeOutOfLock());
    await expect(page.getByTestId(HUD_TEST_ID.menuOverlay)).toBeVisible();
    await expect(page.getByTestId(HUD_TEST_ID.virtualCursor)).toHaveCount(0);
    await expect(page.getByTestId(HUD_TEST_ID.menuMouseLock)).toHaveAttribute('aria-checked', 'true');
    await screenshot(page, 'mouse-lock-menu-after-escape-1920');

    await page.getByTestId(HUD_TEST_ID.menuResume).click();
    await page.waitForTimeout(POINTER_LOCK_RETRY_COOLDOWN_MS);
    await lockAtCentre(page);
    expect(await lockRequests(page)).toBe(2);
  });

  test('keeps the lock through the trait picker, where the cursor hovers and picks a card', async ({ page }) => {
    await openLiveRoom(page, 'lock-card', SEED);
    const centre = await lockAtCentre(page);
    const { gameId, playerId } = await ownRoom(page);
    await callDebugTool(page, 'debug_grant_dna', { gameId, playerId, dna: LEVEL_UP_DNA });
    const card = page.getByTestId(traitCardPickTestId(1));
    await expect(card).toBeVisible();

    const box = (await card.boundingBox())!;
    const target = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    await dispatchOnHost(page, 'pointermove', { x: target.x - centre.x, y: target.y - centre.y });
    await expect(card).toHaveClass(/highlighted/);
    await screenshot(page, 'mouse-lock-card-hover-1920');

    await dispatchOnHost(page, 'pointerdown');
    await expect(page.getByTestId(HUD_TEST_ID.traitOffer)).toHaveCount(0);
    await expect(page.getByTestId(HUD_TEST_ID.virtualCursor)).toBeVisible();
  });

  test('clamps the cursor to the canvas edge on a 32:9 screen', async ({ page }) => {
    await page.setViewportSize(ULTRAWIDE);
    await openLiveRoom(page, 'lock-wide', SEED);
    await lockAtCentre(page);
    await dispatchOnHost(page, 'pointermove', { x: 9000, y: 0 });
    const edge = await cursorCentre(page);
    expect(edge.x).toBe(ULTRAWIDE.width);
    await dispatchOnHost(page, 'pointermove', { x: -300, y: 0 });
    expect((await cursorCentre(page)).x).toBe(ULTRAWIDE.width - 300);
    await screenshot(page, 'mouse-lock-ultrawide-3840');
  });
});
