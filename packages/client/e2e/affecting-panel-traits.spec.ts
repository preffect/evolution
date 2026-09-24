// The hold-Tab panel's TRAITS rows with four traits (docs/ui/overlays.md §3.7, #630), which only a real layout can
// answer: a trait's name and its effect value, mark first, share the panel's fixed width, and at the `UI_SCALE_MIN`
// floor's viewport a long name beside a long value ran the value out past the panel edge ("+5 % spee"). Every trait
// row's value and effect mark must stay inside the panel, and the mark must stay on the value's first line.

import { expect, test, type Page } from '@playwright/test';
import type { TraitId } from '@evolution/shared';
import { affectingTraitTestId } from '../src/app/game/test-ids/hud-test-ids';
import { callDebugTool, ownRoom } from './debug-mcp';
import { openRoom } from './live-room';

/** The `UI_SCALE_MIN` floor's viewport (1024 × 640 at scale 0.8), and the reference one above it. */
const VIEWPORTS = [
  { width: 1024, height: 640 },
  { width: 1280, height: 800 },
] as const;
const TRAITS_SEED = 42;
const GAME_NAME_PREFIX = 'traits';
/** The ticket's cell: level 6 with four traits whose names and first effect lines are among the longest. */
const OWN_LEVEL = 6;
const OWN_MASS = 120;
const OWN_TRAITS: readonly TraitId[] = ['cell_wall', 'mitochondrion', 'simple_flagellum', 'food_vacuole'];
/** Enough ticks for a snapshot to carry the staged cell. */
const STAGE_STEP_TICKS = 3;
/** Sub-pixel rounding between two boxes' edges is not an overflow. */
const EDGE_TOLERANCE_PX = 0.5;

interface TraitRowMeasure {
  readonly traitId: string;
  readonly text: string;
  /** How far the value cell's content and the mark reach past the panel's inner edge, in px; ≤ 0 fits. */
  readonly overflowPx: number;
  /** The mark's top against the value text's first line: a mark left alone on a line above the text is not beside it. */
  readonly markBesideText: boolean;
}

async function measureTraitRows(page: Page): Promise<TraitRowMeasure[]> {
  const rowSelectors = OWN_TRAITS.map((traitId) => `[data-row-id="${affectingTraitTestId(traitId)}"]`);
  const handle = await page.waitForFunction(
    (selectors) => {
      const measures = [];
      for (const selector of selectors) {
        const row = document.querySelector(selector);
        const value = row?.querySelector<HTMLElement>('.value');
        const mark = row?.querySelector<HTMLElement>('ui-effect-mark');
        const panel = row?.closest('ui-panel');
        if (!row || !value || !mark || !panel) return null;
        const panelBox = panel.getBoundingClientRect();
        const panelStyle = getComputedStyle(panel);
        const innerRight = panelBox.right - parseFloat(panelStyle.borderRightWidth);
        // The text's own boxes, not the cell's: a `nowrap` cell's content spills past a cell that stays put.
        const range = document.createRange();
        range.selectNodeContents(value);
        const textBoxes = [...range.getClientRects()].filter((box) => box.width > 0);
        const markBox = mark.getBoundingClientRect();
        const reach = Math.max(markBox.right, ...textBoxes.map((box) => box.right));
        const firstLine = textBoxes.find((box) => box.left >= markBox.right - 1);
        measures.push({
          traitId: selector,
          text: value.textContent?.trim() ?? '',
          overflowPx: reach - innerRight,
          markBesideText: firstLine !== undefined && markBox.top < firstLine.bottom && markBox.bottom > firstLine.top,
        });
      }
      return measures;
    },
    rowSelectors,
    { timeout: 20_000 },
  );
  return (await handle.jsonValue()) as TraitRowMeasure[];
}

for (const viewport of VIEWPORTS) {
  test(`a four-trait cell's trait values stay inside the panel at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openRoom(page, GAME_NAME_PREFIX, TRAITS_SEED);
    const { gameId, playerId } = await ownRoom(page);
    // Frozen, so the snapshot the panel reads is the one staged here.
    await callDebugTool(page, 'debug_pause_room', { gameId });
    await callDebugTool(page, 'debug_set_player', {
      gameId,
      playerId,
      mass: OWN_MASS,
      level: OWN_LEVEL,
      traits: OWN_TRAITS,
    });
    await callDebugTool(page, 'debug_step_room', { gameId, ticks: STAGE_STEP_TICKS });

    await page.keyboard.down('Tab');
    const measures = await measureTraitRows(page);
    const framePath = process.env['FRAME_PATH'];
    if (framePath) await page.screenshot({ path: `${framePath}-${viewport.width}.png` });
    await page.keyboard.up('Tab');
    await callDebugTool(page, 'debug_resume_room', { gameId });

    for (const measure of measures) {
      expect(measure.overflowPx, `${measure.traitId}: ${measure.text}`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      expect(measure.markBesideText, `${measure.traitId}: the mark beside its value`).toBe(true);
    }
  });
}
