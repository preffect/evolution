// The full leaderboard while it widens (docs/ui/hud.md §3.1.1, #615), which only a real layout can answer: with the
// widening slowed so the middle of it can be sampled, no row and no footer is ever wider than the panel, and the
// full columns and footer arrive once the panel is full width. Closing drops them before the panel narrows.

import { expect, test, type Page } from '@playwright/test';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';
import { openRoom } from './live-room';

/** The `UI_SCALE_MIN` floor's viewport, where the board is narrowest. */
const FLOOR_VIEWPORT = { width: 1024, height: 640 };
/** The widening, slowed from `LEADERBOARD_EXPAND_MS` so a sample lands in its middle. */
const SLOW_EXPAND_MS = 8_000;
const SAMPLE_EVERY_MS = 100;
const SEED = 42;

interface BoardSample {
  readonly widthPx: number;
  readonly isFullLayout: boolean;
  readonly overflowing: readonly string[];
}

/** The board's width, whether it draws the full layout, and every row or footer wider than its box. */
function sampleBoard(page: Page): Promise<BoardSample> {
  return page.getByTestId(HUD_TEST_ID.leaderboard).evaluate(boardSample);
}

/** Samples the board inside the page every `everyMs` for `forMs`, so no round trip slows the sampling down. */
function sampleBoardFor(page: Page, forMs: number, everyMs: number): Promise<BoardSample[]> {
  return page.getByTestId(HUD_TEST_ID.leaderboard).evaluate(
    async (board, [duration, step, sampleSource]) => {
      const sample = new Function(`return (${sampleSource})`)() as (element: Element) => BoardSample;
      const samples: BoardSample[] = [];
      const end = performance.now() + duration;
      while (performance.now() < end) {
        samples.push(sample(board));
        await new Promise((resolve) => setTimeout(resolve, step));
      }
      return samples;
    },
    [forMs, everyMs, boardSample.toString()] as const,
  );
}

function boardSample(board: Element): BoardSample {
  return {
    widthPx: board.getBoundingClientRect().width,
    isFullLayout: board.classList.contains('full-layout'),
    overflowing: [...board.querySelectorAll<HTMLElement>('.row, .column-labels, .footer')]
      .filter((part) => part.scrollWidth > part.clientWidth)
      .map((part) => part.className),
  };
}

test('the full board never draws clipped text while it widens or narrows', async ({ page }) => {
  await page.setViewportSize(FLOOR_VIEWPORT);
  await openRoom(page, 'board-expand', SEED);
  await page.addStyleTag({ content: `.leaderboard { transition-duration: ${SLOW_EXPAND_MS}ms !important; }` });

  await page.keyboard.down('Tab');
  const widening = await sampleBoardFor(page, SLOW_EXPAND_MS, SAMPLE_EVERY_MS);
  await expect(page.getByTestId(HUD_TEST_ID.leaderboardFooter)).toBeVisible({ timeout: SLOW_EXPAND_MS });
  const settled = await sampleBoard(page);

  await page.keyboard.up('Tab');
  // One sample early in the slowed narrowing: the full layout has already gone, while the box is still wide.
  await page.waitForTimeout(SAMPLE_EVERY_MS);
  const closing = await sampleBoard(page);

  const midWidening = widening.filter((sample) => sample.widthPx < settled.widthPx - 1);
  expect(midWidening.length).toBeGreaterThan(0);
  for (const sample of widening) expect(sample.overflowing).toEqual([]);
  expect(midWidening.every((sample) => !sample.isFullLayout)).toBe(true);
  expect(settled.isFullLayout).toBe(true);
  expect(settled.overflowing).toEqual([]);
  expect(closing.widthPx).toBeGreaterThan(midWidening[0]?.widthPx ?? 0);
  expect(closing.isFullLayout).toBe(false);
  expect(closing.overflowing).toEqual([]);
});
