// The hold-Tab panel's cause rows with a full-length player name (docs/ui/overlays.md §3.7, #454), which only a real
// layout can answer: at the `UI_SCALE_MIN` floor's viewport, where the name column is tightest, the toxin row naming
// a neighbour with a `PLAYER_NAME_MAX_LENGTH` name keeps its name cell inside the row, cut like the leaderboard's.

import { expect, test, type Page } from '@playwright/test';
import { MASS_RATE_CAUSE, PLAYER_NAME_MAX_LENGTH } from '@evolution/shared';
import { LEADERBOARD_NAME_MAX_CHARS } from '../src/app/game/hud/hud-constants';
import { affectingCauseTestId } from '../src/app/game/test-ids/hud-test-ids';
import { callDebugTool } from './debug-mcp';

/** The `UI_SCALE_MIN` floor's viewport, where §3.7 measured the name column (1024 × 640 at scale 0.8). */
const FLOOR_VIEWPORT = { width: 1024, height: 640 };
/** A name at the lobby's cap, wide in every face: capital W is the widest Latin letter. */
const LONG_NAME = 'W'.repeat(PLAYER_NAME_MAX_LENGTH);
const OWN_NAME = 'Me';
const OWN_AT = { x: -600, y: 600 };
/** The neighbour's centre beside the own cell, in world units: inside Toxin Vacuole's reach. */
const NEIGHBOUR_OFFSET_WU = 45;
const OWN_MASS = 60;
const NEIGHBOUR_MASS = 20;
/** Enough ticks for the metabolism to report the toxin rate and a snapshot to carry it. */
const STAGE_STEP_TICKS = 6;
const TWO_PAGE_TIMEOUT_MS = 240_000;

async function joinLobby(page: Page, name: string): Promise<void> {
  await page.setViewportSize(FLOOR_VIEWPORT);
  await page.goto('/');
  await page.getByRole('textbox').first().fill(name);
  await page.getByRole('button', { name: 'Connect & Join Lobby' }).click();
  await expect(page.locator('.conn')).toHaveText(/connected/);
}

test('a full-length neighbour name stays inside the toxin row at the scale floor, cut like the leaderboard', async ({
  browser,
}) => {
  // Two players' pages in one browser on a shared, busy box: more than the config's default two minutes.
  test.setTimeout(TWO_PAGE_TIMEOUT_MS);
  const own = await browser.newPage();
  const neighbour = await browser.newPage();
  const gameName = `names-${test.info().testId.slice(-8)}`;
  await joinLobby(own, OWN_NAME);
  await joinLobby(neighbour, LONG_NAME);
  await own.getByLabel('Game name').fill(gameName);
  await own.getByRole('button', { name: 'Create' }).click();
  const row = (page: Page) => page.locator('.games li', { hasText: gameName }).first();
  await row(neighbour).getByRole('button', { name: 'Join' }).click();
  await row(own).getByRole('button', { name: 'Start' }).click();
  await expect(own.getByTestId('hud')).toBeVisible();

  const listed = (await callDebugTool(own, 'debug_list_games', {})) as
    { games?: { gameId: string; gameName?: string }[] } | { gameId: string; gameName?: string }[];
  const games = Array.isArray(listed) ? listed : (listed.games ?? []);
  const gameId = (games.find((game) => game.gameName === gameName) ?? games.at(-1))?.gameId ?? '';
  const seats = (await callDebugTool(own, 'debug_get_connections', { gameId })) as {
    playerId: string;
    playerName: string;
  }[];
  const ownSeat = seats.find((seat) => seat.playerName === OWN_NAME)?.playerId ?? '';
  const neighbourSeat = seats.find((seat) => seat.playerName === LONG_NAME)?.playerId ?? '';
  // Frozen, so neither cell drifts after its pointer: the snapshot the panel reads is the one staged here.
  await callDebugTool(own, 'debug_pause_room', { gameId });
  await callDebugTool(own, 'debug_set_player', { gameId, playerId: ownSeat, mass: OWN_MASS, position: OWN_AT });
  await callDebugTool(own, 'debug_set_player', {
    gameId,
    playerId: neighbourSeat,
    mass: NEIGHBOUR_MASS,
    traits: ['toxin_vacuole'],
    position: { x: OWN_AT.x + NEIGHBOUR_OFFSET_WU, y: OWN_AT.y },
  });
  await callDebugTool(own, 'debug_step_room', { gameId, ticks: STAGE_STEP_TICKS });

  await own.keyboard.down('Tab');
  // The kit's facts table carries a row's id as `data-row-id` (ui-facts-table.component.ts). Found and measured in
  // one step, since a paused room's later snapshots may drop the rate and the row with it.
  const rowSelector = `[data-row-id="${affectingCauseTestId(MASS_RATE_CAUSE.toxin)}"]`;
  const measuredHandle = await own.waitForFunction(
    (selector) => {
      const rowElement = document.querySelector(selector);
      const name = rowElement?.querySelector<HTMLElement>('.name');
      const panel = rowElement?.closest('ui-panel');
      if (!name || !panel) return null;
      return {
        text: name.textContent?.trim() ?? '',
        fits: name.scrollWidth <= name.clientWidth,
        insidePanel: name.getBoundingClientRect().right <= panel.getBoundingClientRect().right,
      };
    },
    rowSelector,
    { timeout: 20_000 },
  );
  const measured = (await measuredHandle.jsonValue()) as { text: string; fits: boolean; insidePanel: boolean };
  await own.screenshot({ path: `${process.env['FRAME_PATH'] ?? '/tmp/claude-1000/panel'}-1024.png` });
  await own.keyboard.up('Tab');
  await callDebugTool(own, 'debug_resume_room', { gameId });
  expect(measured.fits).toBe(true);
  expect(measured.insidePanel).toBe(true);
  const shownName = measured.text.split(' ').at(-1) ?? '';
  expect([...shownName].length).toBeLessThanOrEqual(LEADERBOARD_NAME_MAX_CHARS);
  await neighbour.close();
  await own.close();
});
