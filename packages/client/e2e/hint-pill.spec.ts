// The hint pill's line breaking (docs/ui/input-and-onboarding.md §5), which only a real layout can answer: a short
// hint stays one notice row high at the reference viewport, and the longest hint wraps inside the margins of a narrow
// screen instead of running off it.

import { expect, test } from '@playwright/test';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { ONBOARDING_BEAT } from '../src/app/game/hud/format/onboarding-beats';
import { onboardingTextFor } from '../src/app/game/hud/format/onboarding-text';
import { NOTICE_ROW_HEIGHT_PX } from '../src/app/game/hud/hud-constants';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';
import { openRoom } from './live-room';

const REFERENCE_VIEWPORT = { width: 1280, height: 800 };
/** Narrow enough that the endosymbiosis line (~650 px) cannot fit on one line. */
const NARROW_VIEWPORT = { width: 480, height: 800 };
/** Sub-pixel rounding between the layout and the box the browser reports. */
const LAYOUT_TOLERANCE_PX = 1;
const SEED = 42;

test('a short hint is one line at 1280 × 800, and the endosymbiosis hint wraps inside a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize(REFERENCE_VIEWPORT);
  await openRoom(page, 'hint-pill', SEED);
  const pill = page.getByTestId(HUD_TEST_ID.hint);
  await expect(pill).toHaveAttribute('data-hint-id', ONBOARDING_BEAT.steer);
  const shortBox = await pill.boundingBox();
  expect(shortBox?.height).toBeLessThanOrEqual(NOTICE_ROW_HEIGHT_PX + LAYOUT_TOLERANCE_PX);

  await page.setViewportSize(NARROW_VIEWPORT);
  const longText = onboardingTextFor(ONBOARDING_BEAT.endosymbiosis, {
    isTouch: false,
    balance: DEFAULT_BALANCE,
    ownMass: 0,
    ownTraits: [],
  });
  // The beat itself needs a prokaryote; the pill's layout is what is under test, so its words are set in place.
  await pill.evaluate((element, text) => {
    element.textContent = text;
  }, longText);
  const longBox = await pill.boundingBox();
  expect(longBox?.height).toBeGreaterThan(NOTICE_ROW_HEIGHT_PX + LAYOUT_TOLERANCE_PX);
  expect(longBox?.x).toBeGreaterThanOrEqual(0);
  expect((longBox?.x ?? 0) + (longBox?.width ?? 0)).toBeLessThanOrEqual(NARROW_VIEWPORT.width);
});
