// Every catalog trait card fits its box (#428, docs/ui/overlays.md §3.2, decision #425), measured where the lines
// actually wrap: a real browser laying out the real card. The line-count guard in `trait-effects.spec.ts` counts
// effect lines, but a long line wraps onto rows it never sees, which is how Amoeba Pseudopods `I → II` needed 225 px
// in a 214 px card and the rarity row spilled onto the key chip while that spec passed. This one draws every card on
// the `?cards` sheet and fails when any card's content runs past its padding or its rarity row meets the key chip.
//
// Fonts: the shipped face is Inter (`styles.css`), but a player whose font has not loaded yet, or never loads, reads
// the stack's fallbacks, so every card is measured again in each fallback face this machine has. Inter and DejaVu Sans
// (the Linux fallback, in the devcontainer image) are required; Segoe UI (Windows) and Liberation Sans (Arial's
// metrics) are measured when installed and named in the test's annotations when not.

import { expect, test, type Page } from '@playwright/test';
import { CARD_SHEET_QUERY_KEY } from '../src/app/game/hud/card-sheet/card-sheet-query';
import { HUD_TEST_ID } from '../src/app/game/test-ids/hud-test-ids';

/** The reference viewport (scale 1) and the `UI_SCALE_MIN` floor's (scale 0.8), where rounding differs. */
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1024, height: 640 },
] as const;
/** `null` is the shipped stack as it resolves (Inter); a name forces that face on every card. */
const REQUIRED_FACES = [null, 'DejaVu Sans'] as const;
const OPTIONAL_FACES = ['Segoe UI', 'Liberation Sans'] as const;
/** Sub-pixel rounding between two boxes' edges is not an overflow. */
const EDGE_TOLERANCE_PX = 0.5;

interface CardMeasure {
  readonly cardId: string;
  /** How far the lowest in-flow row reaches past the card's content box, in px; ≤ 0 fits. */
  readonly overflowPx: number;
  readonly isRarityOnKeyChip: boolean;
}

async function openSheet(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(`/?${CARD_SHEET_QUERY_KEY}`);
  await expect(page.getByTestId(HUD_TEST_ID.traitCardSheet)).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Whether `face` is installed: text set in it measures differently from the same text in the generic fallback. */
async function isFaceInstalled(page: Page, face: string): Promise<boolean> {
  return page.evaluate((family) => {
    const probe = document.createElement('canvas').getContext('2d');
    if (probe === null) return false;
    const sample = 'Amoeba Pseudopods I → II · harder to engulf';
    return ['monospace', 'serif'].some((generic) => {
      probe.font = `16px ${generic}`;
      const genericWidth = probe.measureText(sample).width;
      probe.font = `16px "${family}", ${generic}`;
      return probe.measureText(sample).width !== genericWidth;
    });
  }, face);
}

async function forceFace(page: Page, face: string): Promise<void> {
  // The card reads `--ui-font-sans`, which the kit surface sets inline, so only an `!important` rule outranks it.
  await page.addStyleTag({ content: `app-trait-card .card { font-family: "${face}" !important; }` });
}

async function measureCards(page: Page): Promise<CardMeasure[]> {
  return page.evaluate(() => {
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return [...document.querySelectorAll<HTMLElement>('app-trait-card[data-card-id]')].map((host) => {
      const card = host.querySelector<HTMLElement>('.card');
      const rarity = host.querySelector<HTMLElement>('.rarity');
      const keyChip = host.querySelector<HTMLElement>('.key-chip');
      if (card === null || rarity === null || keyChip === null) throw new Error('a card is missing a row');
      const cardBox = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      const contentBottom = cardBox.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom);
      // The in-flow rows only: the ribbon and the key chip are placed over the card and take no height.
      const rows = [...card.children].filter((child) => getComputedStyle(child).position !== 'absolute');
      const lowest = Math.max(...rows.map((row) => row.getBoundingClientRect().bottom));
      return {
        cardId: host.dataset['cardId'] ?? '',
        overflowPx: lowest - contentBottom,
        isRarityOnKeyChip: overlaps(rarity.getBoundingClientRect(), keyChip.getBoundingClientRect()),
      };
    });
  });
}

function expectEveryCardFits(measures: readonly CardMeasure[], label: string): void {
  expect(measures.length, `${label}: the sheet drew no cards`).toBeGreaterThan(0);
  const overflowing = measures.filter((card) => card.overflowPx > EDGE_TOLERANCE_PX || card.isRarityOnKeyChip);
  expect(
    overflowing.map((card) => `${card.cardId} +${card.overflowPx.toFixed(1)} px`),
    `${label}: cards whose rows run past the card`,
  ).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test(`every catalog trait card fits its box at ${viewport.width} × ${viewport.height}, in every fallback face`, async ({
    page,
  }) => {
    const measuredFaces: string[] = [];
    for (const face of [...REQUIRED_FACES, ...OPTIONAL_FACES]) {
      await openSheet(page, viewport);
      if (face !== null) {
        const isRequired = (REQUIRED_FACES as readonly (string | null)[]).includes(face);
        const isInstalled = await isFaceInstalled(page, face);
        if (isRequired) expect(isInstalled, `${face} is installed`).toBe(true);
        if (!isInstalled) {
          test.info().annotations.push({ type: 'face not installed', description: face });
          continue;
        }
        await forceFace(page, face);
      }
      const label = face ?? 'the shipped stack';
      expectEveryCardFits(await measureCards(page), label);
      measuredFaces.push(label);
    }
    test.info().annotations.push({ type: 'faces measured', description: measuredFaces.join(', ') });
  });
}
