// The leaderboard's score column with a six-digit score (docs/ui/hud.md §3.1.1, #427), which only a real layout can
// answer: the score cell's text fits its column on the full board, where the mass column sits right beside it.

import { expect, test } from '@playwright/test';
import { playerId as toPlayerId } from '@evolution/shared';
import { HUD_TEST_ID, leaderboardRowTestId } from '../src/app/game/test-ids/hud-test-ids';
import { callDebugTool, ownRoom } from './debug-mcp';
import { openRoom } from './live-room';

const REFERENCE_VIEWPORT = { width: 1280, height: 800 };
/** A score past the five digits the column was sized for. */
const SIX_DIGIT_SCORE = 123_456;
const SEED = 42;

test('a six-digit score fits the score column on the full board, and reads 123k', async ({ page }) => {
  await page.setViewportSize(REFERENCE_VIEWPORT);
  await openRoom(page, 'score-width', SEED);
  const { gameId, playerId } = await ownRoom(page);
  await callDebugTool(page, 'debug_grant_dna', { gameId, playerId, dna: SIX_DIGIT_SCORE });
  await callDebugTool(page, 'debug_pause_room', { gameId });
  await page.getByTestId(HUD_TEST_ID.leaderboardHeader).click();
  const score = page.getByTestId(leaderboardRowTestId(toPlayerId(playerId))).locator('.score');
  await expect(score).toHaveText('123k');
  const fits = await score.evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fits).toBe(true);
  await callDebugTool(page, 'debug_resume_room', { gameId });
});
