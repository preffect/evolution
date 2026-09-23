// The full leaderboard while it widens (docs/ui/hud.md §3.1.1, #615), which only a real layout can answer. The
// widening is frozen at its mid-point rather than sampled on a timer, so the check never depends on frame timing:
// there, and once it settles, no row, label strip or footer is wider than its box and every name cell keeps its
// minimum width. Then the two ways a width transition ends with no `transitionend` — a release and re-press inside
// one frame, and the panel hidden mid-widen — must still land on the full layout.

import { expect, test, type Page } from '@playwright/test';
import { LEADERBOARD_NAME_COLUMN_MIN_PX } from '../src/app/game/hud/hud-constants';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';
import { openRoom } from './live-room';

/** The `UI_SCALE_MIN` floor's viewport, where the board is narrowest. */
const FLOOR_VIEWPORT = { width: 1024, height: 640 };
const SEED = 42;
/** Where in the widening the board is frozen: its middle. */
const MID_POINT = 0.5;
/** Long enough for any width transition the board runs to have ended on a slow headless frame. */
const SETTLE_MS = 2_000;
const LAYOUT_TOLERANCE_PX = 1;
/** The widening slowed from `LEADERBOARD_EXPAND_MS` for the tests that must catch it running. */
const SLOW_WIDENING_MS = 8_000;

interface BoardState {
  readonly widthPx: number;
  readonly isFullLayout: boolean;
  /** Rows, label strips or the footer wider than their box. */
  readonly overflowing: readonly string[];
  /** The narrowest name cell, in px; `null` with no rows. */
  readonly narrowestNamePx: number | null;
  readonly scale: number;
}

function boardState(page: Page): Promise<BoardState> {
  return page.getByTestId(HUD_TEST_ID.leaderboard).evaluate((board) => {
    const names = [...board.querySelectorAll<HTMLElement>('.row .name')].map((name) => name.clientWidth);
    return {
      widthPx: board.getBoundingClientRect().width,
      isFullLayout: board.classList.contains('full-layout'),
      overflowing: [...board.querySelectorAll<HTMLElement>('.row, .column-labels, .footer')]
        .filter((part) => part.scrollWidth > part.clientWidth)
        .map((part) => part.className),
      narrowestNamePx: names.length === 0 ? null : Math.min(...names),
      scale: Number(getComputedStyle(board).getPropertyValue('--ui-scale')) || 1,
    };
  });
}

/** Nothing clipped, and while the full layout is on every name cell keeps its minimum track. */
function expectUnclipped(state: BoardState): void {
  expect(state.overflowing).toEqual([]);
  if (state.isFullLayout) {
    expect(state.narrowestNamePx ?? 0).toBeGreaterThanOrEqual(
      LEADERBOARD_NAME_COLUMN_MIN_PX * state.scale - LAYOUT_TOLERANCE_PX,
    );
  }
}

/** Freezes the board's running width transition at `fraction` of its duration (1 runs it to its end at once); false when none runs. */
function freezeWidening(page: Page, fraction: number): Promise<boolean> {
  return page.getByTestId(HUD_TEST_ID.leaderboard).evaluate((board, at) => {
    const transition = board
      .getAnimations()
      .find((animation) => (animation as CSSTransition).transitionProperty === 'width');
    if (transition === undefined) return false;
    if (at >= 1) {
      transition.play();
      transition.finish();
      return true;
    }
    const duration = Number(transition.effect?.getTiming().duration ?? 0);
    transition.pause();
    transition.currentTime = duration * at;
    return true;
  }, fraction);
}

/**
 * Tab released and pressed again `gapMs` apart, in the page so no round trip widens the gap. Inside a slow frame the
 * narrowing has started but not moved when the press cancels it, so no widening transition runs and no
 * `transitionend` ever fires (the reviewer's stuck case, 180–260 ms apart on this box's software-rendered frames).
 */
function tapTabAgain(page: Page, gapMs: number): Promise<void> {
  return page.evaluate(async (gap) => {
    const press = (type: string) =>
      document.dispatchEvent(new KeyboardEvent(type, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    press('keyup');
    await new Promise((resolve) => setTimeout(resolve, gap));
    press('keydown');
  }, gapMs);
}

/** Release-to-press gaps around one slow frame, in ms: the stuck window moves with the frame time. */
const RE_PRESS_GAPS_MS = [0, 60, 120, 180, 220, 260];

test.describe('the full leaderboard while it widens', () => {
  let settledWidthPx = 0;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FLOOR_VIEWPORT);
    await openRoom(page, 'board-expand', SEED);
    // Once open and closed, so the live balance is in and the footer exists before anything is measured.
    await page.keyboard.down('Tab');
    await expect(page.getByTestId(HUD_TEST_ID.leaderboardFooter)).toBeVisible({ timeout: SLOW_WIDENING_MS });
    settledWidthPx = (await boardState(page)).widthPx;
    await page.keyboard.up('Tab');
    await page.waitForTimeout(SETTLE_MS);
  });

  test('draws nothing clipped at the widening’s mid-point, and the full layout only once it is full width', async ({
    page,
  }) => {
    // Slowed, so the transition is still running when the first evaluate reaches it on a slow headless frame.
    await page.addStyleTag({ content: `.leaderboard { transition-duration: ${SLOW_WIDENING_MS}ms !important; }` });
    await page.keyboard.down('Tab');
    await expect.poll(() => freezeWidening(page, MID_POINT), { timeout: SLOW_WIDENING_MS }).toBe(true);
    const middle = await boardState(page);
    expect(middle.widthPx).toBeLessThan(settledWidthPx - LAYOUT_TOLERANCE_PX);
    // The clipping check first, so it is what catches a full layout drawn too early, not only the flag below.
    expectUnclipped(middle);
    expect(middle.isFullLayout).toBe(false);

    await freezeWidening(page, 1);
    await expect.poll(async () => (await boardState(page)).isFullLayout, { timeout: SLOW_WIDENING_MS }).toBe(true);
    expectUnclipped(await boardState(page));

    await page.keyboard.up('Tab');
    // The slowed narrowing leaves the box wide for seconds; the full layout must go well before it narrows.
    await expect.poll(async () => (await boardState(page)).isFullLayout, { timeout: SLOW_WIDENING_MS }).toBe(false);
    const closing = await boardState(page);
    expect(closing.widthPx).toBeGreaterThan(middle.widthPx);
    expectUnclipped(closing);
  });

  test('lands on the full layout after a release and re-press inside one frame, at every gap', async ({ page }) => {
    await page.keyboard.down('Tab');
    for (const gapMs of RE_PRESS_GAPS_MS) {
      await expect.poll(async () => (await boardState(page)).isFullLayout, { timeout: SLOW_WIDENING_MS }).toBe(true);
      await tapTabAgain(page, gapMs);
      await page.waitForTimeout(SETTLE_MS);
      const state = await boardState(page);
      expect({ gapMs, isFullLayout: state.isFullLayout }).toEqual({ gapMs, isFullLayout: true });
      expect(Math.abs(state.widthPx - settledWidthPx)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
      expectUnclipped(state);
    }
  });

  test('lands on the full layout after the panel is hidden mid-widen', async ({ page }) => {
    await page.addStyleTag({ content: `.leaderboard { transition-duration: ${SLOW_WIDENING_MS}ms !important; }` });
    await page.keyboard.down('Tab');
    await expect.poll(() => freezeWidening(page, MID_POINT), { timeout: SLOW_WIDENING_MS }).toBe(true);
    await page.getByTestId(HUD_TEST_ID.leaderboard).evaluate((board) => {
      (board as HTMLElement).style.display = 'none';
    });
    await page.waitForTimeout(SETTLE_MS / 4);
    await page.getByTestId(HUD_TEST_ID.leaderboard).evaluate((board) => {
      (board as HTMLElement).style.display = '';
    });
    await page.waitForTimeout(SETTLE_MS);
    const state = await boardState(page);
    expect(Math.abs(state.widthPx - settledWidthPx)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
    expect(state.isFullLayout).toBe(true);
    expectUnclipped(state);
  });
});
