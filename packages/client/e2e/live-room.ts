// Opening a live room from the lobby, shared by the Playwright specs that need one (docs/TESTING.md, the UI tier).
// It lived in `render-smoke.spec.ts` until a second spec needed the same seven clicks; one home, so a change to the
// lobby's markup is one edit rather than a hunt.

import { expect, test, type Page } from '@playwright/test';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';

/** The debug hook the client exposes in a development build: the room's clock, for deterministic frames. */
export interface DebugWindow {
  __evolutionDebug?: {
    pause(): void;
    step(frames?: number): void;
    renderTick(): number | null;
    isPaused(): boolean;
  };
}

/** `AUDIO_ASSET_BASE_PATH`: the audio assets are opt-in (docs/AUDIO-PIPELINE.md); a missing one is a silent cue. */
const AUDIO_ASSET_PATH = '/assets/audio/';
/** Enough of the test id to tell rooms apart while staying under `GAME_NAME_MAX_LENGTH`. */
const GAME_NAME_SUFFIX_LENGTH = 8;

/**
 * Creates and starts a fresh room named after the test, so reruns never pick an already-started one, and waits until
 * the **HUD** is up. Returns the page errors collected from the moment it opened — a spec asserts on them when it
 * cares.
 *
 * It stops at the HUD rather than at the first rendered frame because most of what a UI spec drives — the menu, the
 * encyclopedia, the overlays — is DOM that is live before the renderer is, and waiting on a WebGL canvas makes a
 * spec about a panel fail for a reason that has nothing to do with it. A spec that needs the renderer calls
 * `waitForFirstFrame` after this.
 */
export async function openRoom(page: Page, namePrefix: string, seed: number): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const isMissingAudioAsset = message.location().url.includes(AUDIO_ASSET_PATH);
    if (message.type() === 'error' && !isMissingAudioAsset)
      errors.push(`${message.text()} (${message.location().url})`);
  });
  const gameName = `${namePrefix}-${test.info().testId.slice(-GAME_NAME_SUFFIX_LENGTH)}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect & Join Lobby' }).click();
  await expect(page.locator('.conn')).toHaveText(/connected/);
  await page.getByLabel('Game name').fill(gameName);
  await page.getByTestId('create-seed').fill(String(seed));
  await page.getByRole('button', { name: 'Create' }).click();
  const row = page
    .locator('.games li', { hasText: gameName })
    .filter({ hasNot: page.locator('.badge') })
    .first();
  await row.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId(HUD_TEST_ID.hud)).toBeVisible();
  return errors;
}

/** The renderer's first frame: the Pixi canvas in the DOM and the room clock running. */
export async function waitForFirstFrame(page: Page): Promise<void> {
  await expect(page.locator('canvas[data-testid="game-canvas"]')).toBeVisible();
  await page.waitForFunction(() => (window as DebugWindow).__evolutionDebug?.renderTick() !== null);
}

/** A room open and drawing: what the renderer's own specs want. */
export async function openLiveRoom(page: Page, namePrefix: string, seed: number): Promise<string[]> {
  const errors = await openRoom(page, namePrefix, seed);
  await waitForFirstFrame(page);
  return errors;
}
