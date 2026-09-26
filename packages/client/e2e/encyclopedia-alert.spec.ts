// U10 of docs/ui/components-and-constants.md §8, on a live room: the alert strip the HUD shell projects into the
// encyclopedia's header (`encyclopedia-alert`, docs/ui/encyclopedia.md §11.1, #448), in each of its states. Run with
// `pnpm --filter @evolution/client smoke`; not part of `./validate.sh all`.
//
// It is the host's spec, not the entry page's (#472): the strip is the shell's projection, so it reads the same over
// any page, and it lives in its own file so the next page's spec does not inherit it as a skip.
//
// The staging is the harness's own debug driver (`debug-mcp.ts`), with no tool added for it. `debug_spawn` places
// motes and fragments only, so U10's "200-mass cell adjacent" is an `idle` bot that `debug_set_player` sizes and
// places: a real cell that holds still, which is what the step means.

import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BALANCE, FIRST_LEVEL, levelUpCost, radiusForMass } from '@evolution/shared';
import { ENCYCLOPEDIA_TEST_ID } from '../src/app/game/encyclopedia/test-ids';
import { OVERLAY_ALERT_KIND } from '../src/app/game/hud/format/overlay-alert';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';
import { callDebugTool, ownRoom } from './debug-mcp';
import { openRoom } from './live-room';

const ALERT_SEED = 42;
const GAME_NAME_PREFIX = 'alert';
/** U3's grant: the first level's DNA, so the level-up opens a trait offer. */
const LEVEL_UP_DNA = levelUpCost(FIRST_LEVEL, DEFAULT_BALANCE.progression);
/** U10's predator, and the cell a starting cell cannot engulf back. */
const PREDATOR_MASS = 200;
/** Between the two membranes while it only threatens: near enough to be on screen, far from touching. */
const THREAT_GAP_WU = 40;
/** The trait card `1` picks on a first offer: the nucleoid, U4's rung. */
const FIRST_PICK_TRAIT = 'nucleoid:1';

interface CellEntity {
  readonly playerId: string | null;
  readonly x: number;
  readonly y: number;
  readonly mass: number;
}

/** The player's cell once the world holds it: a bot's cell arrives on the tick after it joins. */
async function cellOf(page: Page, gameId: string, playerId: string): Promise<CellEntity> {
  let found: CellEntity | undefined;
  await expect
    .poll(async () => {
      const cells = (await callDebugTool(page, 'debug_get_entities', { gameId, kind: 'cell' })) as CellEntity[];
      found = cells.find((cell) => cell.playerId === playerId);
      return found !== undefined;
    })
    .toBe(true);
  return found!;
}

function alertStrip(page: Page): ReturnType<Page['getByTestId']> {
  return page.getByTestId(ENCYCLOPEDIA_TEST_ID.alert);
}

test('U10: the encyclopedia header shows the offer, then the threat, then the engulf, over the open panel', async ({
  page,
}) => {
  await openRoom(page, GAME_NAME_PREFIX, ALERT_SEED);
  const { gameId, playerId } = await ownRoom(page);
  await page.getByTestId(HUD_TEST_ID.gameHost).focus();
  await page.keyboard.press('h');
  await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeVisible();
  await expect(alertStrip(page)).toHaveCount(0);

  await callDebugTool(page, 'debug_grant_dna', { gameId, playerId, dna: LEVEL_UP_DNA });
  await expect(alertStrip(page)).toHaveAttribute('data-alert-kind', OVERLAY_ALERT_KIND.offer);

  // The pick goes through with the panel still up: the offer is answered, not expired (the cell owns the rung).
  await page.keyboard.press('1');
  await expect(page.getByTestId(HUD_TEST_ID.traitOffer)).toHaveCount(0);
  await expect(page.getByTestId(HUD_TEST_ID.ownCell)).toHaveAttribute('data-traits', new RegExp(FIRST_PICK_TRAIT));
  await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeVisible();
  await expect(alertStrip(page)).toHaveCount(0);

  const own = await cellOf(page, gameId, playerId);
  const bot = (await callDebugTool(page, 'debug_spawn_bot', { gameId, behavior: 'idle' })) as { playerId: string };
  await cellOf(page, gameId, bot.playerId);
  const threatX =
    own.x +
    radiusForMass(own.mass, DEFAULT_BALANCE.growth) +
    radiusForMass(PREDATOR_MASS, DEFAULT_BALANCE.growth) +
    THREAT_GAP_WU;
  await callDebugTool(page, 'debug_set_player', {
    gameId,
    playerId: bot.playerId,
    mass: PREDATOR_MASS,
    position: { x: threatX, y: own.y },
  });
  await expect(alertStrip(page)).toHaveAttribute('data-alert-kind', OVERLAY_ALERT_KIND.threat);

  // Onto the cell: contact starts the engulf, which outranks the threat it came from.
  const current = await cellOf(page, gameId, playerId);
  await callDebugTool(page, 'debug_set_player', {
    gameId,
    playerId: bot.playerId,
    position: { x: current.x, y: current.y },
  });
  await expect(alertStrip(page)).toHaveAttribute('data-alert-kind', OVERLAY_ALERT_KIND.engulfed);
  await expect(page.getByTestId(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeVisible();
});
